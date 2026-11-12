// Speed profile solver (the classic "lap simulation" trick).
//
// For a given car and track we work out, for every 2 m sample:
//   1. the fastest speed the tyres can hold through the local curvature,
//   2. walking BACKWARDS: how early the car must brake to make each corner,
//   3. walking FORWARDS: how fast the engine can actually get it there.
// The result is the ideal speed at every point of the lap. The race AI uses
// the corner+brake part as its target; the full profile gives a lap time used
// for the Performance Index and for qualifying.

import { G, AIR_DENSITY, MAX_TABLE_SPEED, gripOn, rollingResistance } from './vehicle.js';

// The racing line straightens corners compared to the track centre line.
export const RACING_LINE_FACTOR = 0.60;

function downforceAccel(perf, v) {
    return (0.5 * AIR_DENSITY * perf.clA * v * v) / perf.mass;
}

function dragAccel(perf, v, dirt) {
    return (0.5 * AIR_DENSITY * perf.cdA * v * v) / perf.mass + rollingResistance(dirt) * G;
}

/** Fraction of longitudinal grip left when the tyres are also cornering. */
function gripLeft(lateral, lateralMax) {
    const used = Math.min(1, lateral / Math.max(0.01, lateralMax));
    return Math.sqrt(Math.max(0.04, 1 - used * used));
}

export function maxBrakeDecel(perf, v, dirt, kEff) {
    const mu = gripOn(perf, dirt);
    const tyreMax = mu * (G + downforceAccel(perf, v));
    const lateral = v * v * kEff;
    const tyreLong = tyreMax * 1.02 * gripLeft(lateral, tyreMax);
    return Math.min(perf.brakeG * G, tyreLong) + dragAccel(perf, v, dirt);
}

export function maxDriveAccel(perf, v, dirt, kEff, forceBoost = 1) {
    const mu = gripOn(perf, dirt);
    const tyreMax = mu * (G + downforceAccel(perf, v));
    const lateral = v * v * kEff;
    const traction = tyreMax * 1.05 * perf.driveFrac * gripLeft(lateral, tyreMax);
    const engine = (perf.forceTable[Math.min(MAX_TABLE_SPEED, Math.round(v))] * forceBoost) / perf.mass;
    return Math.min(engine, traction) - dragAccel(perf, v, dirt);
}

/**
 * @returns {{ limit: Float64Array, ideal: Float64Array, lapTime: number }}
 *   limit = corner speed + braking zones (no engine limit) in m/s
 *   ideal = limit capped by what the engine can reach
 */
export function computeProfile(track, perf) {
    const n = track.n;
    const ds = track.ds;
    const limit = new Float64Array(n);

    // 1) Steady-state corner speed.
    for (let i = 0; i < n; i++) {
        const k = Math.abs(track.curvature[i]) * RACING_LINE_FACTOR;
        const mu = gripOn(perf, track.dirt[i]);
        if (k < 1e-5) { limit[i] = MAX_TABLE_SPEED; continue; }
        // v^2 * k = mu * (g + aero*v^2)  ->  v^2 = mu*g / (k - mu*aero)
        const aero = (0.5 * AIR_DENSITY * perf.clA) / perf.mass;
        const denom = k - mu * aero;
        limit[i] = denom <= 1e-6 ? MAX_TABLE_SPEED : Math.min(MAX_TABLE_SPEED, Math.sqrt((mu * G) / denom));
    }

    // 2) Backward pass: braking zones. Two laps so the wrap-around settles.
    for (let pass = 0; pass < 2; pass++) {
        for (let i = n - 1; i >= 0; i--) {
            const next = (i + 1) % n;
            const vNext = limit[next];
            const kEff = Math.abs(track.curvature[next]) * RACING_LINE_FACTOR;
            const decel = maxBrakeDecel(perf, vNext, track.dirt[next], kEff);
            const reachable = Math.sqrt(vNext * vNext + 2 * decel * ds);
            if (reachable < limit[i]) limit[i] = reachable;
        }
    }

    // 3) Forward pass: engine + traction limited acceleration.
    const ideal = Float64Array.from(limit);
    let slowest = 0;
    for (let i = 1; i < n; i++) if (ideal[i] < ideal[slowest]) slowest = i;
    for (let pass = 0; pass < 2; pass++) {
        for (let step = 0; step < n; step++) {
            const i = (slowest + step) % n;
            const next = (i + 1) % n;
            const v = ideal[i];
            const kEff = Math.abs(track.curvature[i]) * RACING_LINE_FACTOR;
            const accel = maxDriveAccel(perf, v, track.dirt[i], kEff);
            const reachable = accel > 0 ? Math.sqrt(v * v + 2 * accel * ds) : v;
            if (reachable < ideal[next]) ideal[next] = reachable;
        }
    }

    let lapTime = 0;
    for (let i = 0; i < n; i++) lapTime += ds / Math.max(1, ideal[i]);

    return { limit, ideal, lapTime };
}
