// Vehicle performance model.
//
// A car in the data files is a plain "spec sheet" (hp, kg, tyres, aero...).
// derivePerf() turns spec + installed upgrades + condition + driver skills into
// the numbers the simulation needs: a torque curve, gearing, grip, braking and
// a few lookup tables. Units are SI: metres, seconds, kilograms, newtons.

import { clamp, lerp } from '../core/rng.js';

export const G = 9.81;
export const AIR_DENSITY = 1.225;
const DRIVER_MASS_KG = 75;
const DRIVELINE_EFFICIENCY = 0.88;
const IDLE_RPM = 950;
export const MAX_TABLE_SPEED = 140; // m/s (504 km/h) upper bound of the lookup tables

// How much of the car's weight sits on the driven wheels under acceleration.
const DRIVE_FRACTION = { FWD: 0.54, RWD: 0.62, AWD: 0.97 };

/** Normalised torque shape over rpm/redline. Peak torque sits mid-range. */
function torqueShape(r) {
    const d = r - 0.55;
    return Math.max(0.35, 1 - 1.6 * d * d);
}

/**
 * Combine a base spec with upgrade effects. Each effect object can contain:
 *   powerPct, weight (kg, negative = lighter), grip, dirtGrip, brake, cdA, clA,
 *   shiftTime (multiplier), nitroCap (seconds), nitroPower, redline.
 */
export function applyEffects(spec, effectsList) {
    const out = { ...spec, nitroCap: 0, nitroPower: 0, shiftTimeMul: 1 };
    let powerPct = 0;
    for (const fx of effectsList) {
        if (!fx) continue;
        powerPct += fx.powerPct || 0;
        out.weight += fx.weight || 0;
        out.grip += fx.grip || 0;
        out.dirtGrip += fx.dirtGrip || 0;
        out.brake += fx.brake || 0;
        out.cdA += fx.cdA || 0;
        out.clA += fx.clA || 0;
        out.redline += fx.redline || 0;
        out.nitroCap += fx.nitroCap || 0;
        out.nitroPower += fx.nitroPower || 0;
        if (fx.shiftTime) out.shiftTimeMul *= fx.shiftTime;
    }
    out.hp = spec.hp * (1 + powerPct / 100);
    out.weight = Math.max(500, out.weight);
    return out;
}

/**
 * @param {object} spec    car spec (already passed through applyEffects, or raw)
 * @param {object} [mods]  { condition: {engine,tires,suspension} 0-100, skills: {...levels} }
 */
export function derivePerf(spec, mods = {}) {
    const cond = mods.condition || { engine: 100, tires: 100, suspension: 100 };
    const skills = mods.skills || {};
    const engineHealth = clamp(cond.engine / 100, 0, 1);
    const tyreHealth = clamp(cond.tires / 100, 0, 1);
    const suspHealth = clamp(cond.suspension / 100, 0, 1);

    const mass = spec.weight + DRIVER_MASS_KG;
    const powerW = spec.hp * 745.7 * lerp(0.86, 1, engineHealth);
    const redline = spec.redline;
    const wheelR = spec.wheelRadius || 0.31;

    // Scale the torque curve so its best point produces exactly `powerW`.
    let bestPowerPerNm = 0;
    for (let r = 0.3; r <= 1.0001; r += 0.01) {
        const omega = (r * redline * 2 * Math.PI) / 60;
        bestPowerPerNm = Math.max(bestPowerPerNm, torqueShape(r) * omega);
    }
    const peakTorque = powerW / bestPowerPerNm;
    const torqueAt = (rpm) => peakTorque * torqueShape(clamp(rpm, IDLE_RPM, redline) / redline);

    const conditionGrip = lerp(0.90, 1, tyreHealth) * lerp(0.95, 1, suspHealth);
    const muTarmac = spec.grip * conditionGrip;
    const muDirt = spec.dirtGrip * conditionGrip;
    const brakeG = (spec.brake * lerp(0.93, 1, suspHealth)) * (1 + 0.02 * (skills.braking || 0));
    const cdA = Math.max(0.3, spec.cdA);
    const clA = Math.max(0, spec.clA);
    const driveFrac = DRIVE_FRACTION[spec.drivetrain] || 0.6;

    // Drag-limited top speed (tarmac, no nitro): P*eff = (drag + rolling) * v
    let vTop = 20;
    for (let v = 20; v < MAX_TABLE_SPEED; v += 0.25) {
        const resist = 0.5 * AIR_DENSITY * cdA * v * v + 0.014 * mass * G;
        if (resist * v > powerW * DRIVELINE_EFFICIENCY) break;
        vTop = v;
    }

    // Gearbox: geometric ratios from a launch gear up to a top gear that
    // reaches vTop just before the limiter.
    const gearCount = spec.gears || 5;
    const finalDrive = 3.9;
    const wheelRpmPerMs = 60 / (2 * Math.PI * wheelR);
    const topRatio = (redline * 0.97) / (vTop * 1.03 * wheelRpmPerMs * finalDrive);
    const firstSpeed = clamp(vTop * 0.27, 11, 24);
    const firstRatio = redline / (firstSpeed * wheelRpmPerMs * finalDrive);
    const ratios = [];
    for (let g = 0; g < gearCount; g++) {
        ratios.push(firstRatio * Math.pow(topRatio / firstRatio, g / (gearCount - 1)));
    }
    const rpmAt = (v, gear) => v * wheelRpmPerMs * ratios[gear] * finalDrive;
    const wheelForce = (v, gear) => {
        const rpm = rpmAt(v, gear);
        if (rpm > redline) return 0;
        // Below idle the clutch slips: the engine sits in its launch band.
        const engineRpm = rpm < 2200 ? Math.max(rpm, Math.min(redline * 0.55, 3800)) : rpm;
        return (torqueAt(engineRpm) * ratios[gear] * finalDrive * DRIVELINE_EFFICIENCY) / wheelR;
    };

    // Ideal shift points: change up when the next gear pushes harder.
    const upshiftSpeed = [];
    for (let g = 0; g < gearCount - 1; g++) {
        const limit = redline / (wheelRpmPerMs * ratios[g] * finalDrive);
        let at = limit * 0.985;
        for (let v = limit * 0.5; v < limit; v += 0.1) {
            if (wheelForce(v, g + 1) >= wheelForce(v, g)) { at = v; break; }
        }
        upshiftSpeed.push(at);
    }

    // Best-gear force envelope, used for lap-time estimates.
    const forceTable = new Float64Array(MAX_TABLE_SPEED + 1);
    for (let v = 0; v <= MAX_TABLE_SPEED; v++) {
        let best = 0;
        for (let g = 0; g < gearCount; g++) best = Math.max(best, wheelForce(Math.max(0.5, v), g));
        forceTable[v] = best;
    }

    const baseShift = spec.shiftTime || 0.26;
    const shiftTime = baseShift * (spec.shiftTimeMul || 1) * (1 - 0.05 * (skills.shifting || 0));

    return {
        mass, powerW, redline, idleRpm: IDLE_RPM, wheelR,
        ratios, finalDrive, gearCount, upshiftSpeed,
        rpmAt, wheelForce, forceTable,
        muTarmac, muDirt, brakeG, cdA, clA, driveFrac,
        vTop,
        shiftTime: Math.max(0.05, shiftTime),
        nitroCap: (4.5 + (spec.nitroCap || 0)) * (1 + 0.08 * (skills.nitro || 0)),
        nitroPower: 0.28 + (spec.nitroPower || 0),
        drivetrain: spec.drivetrain
    };
}

/** Grip coefficient on a surface mix (0 = tarmac, 1 = dirt). */
export function gripOn(perf, dirt) {
    return lerp(perf.muTarmac, perf.muDirt, dirt);
}

export function rollingResistance(dirt) {
    return lerp(0.014, 0.042, dirt);
}

/** Headline numbers for the garage: 0-100 km/h time, top speed, lateral g. */
export function headlineStats(perf) {
    let v = 0;
    let t = 0;
    const dt = 0.02;
    const target = 100 / 3.6;
    while (v < target && t < 30) {
        const engine = perf.forceTable[Math.min(MAX_TABLE_SPEED, Math.round(v))];
        const traction = perf.muTarmac * 1.05 * perf.mass * G * perf.driveFrac;
        const force = Math.min(engine, traction) - 0.5 * AIR_DENSITY * perf.cdA * v * v - 0.014 * perf.mass * G;
        v += (force / perf.mass) * dt;
        t += dt;
    }
    const refSpeed = 33; // m/s, where downforce starts to matter
    const lateralG = perf.muTarmac * (1 + (0.5 * AIR_DENSITY * perf.clA * refSpeed * refSpeed) / (perf.mass * G));
    return {
        zeroToHundred: t,
        topSpeedKmh: perf.vTop * 3.6,
        lateralG,
        brakeG: Math.min(perf.brakeG, perf.muTarmac * 1.05),
        dirtGrip: perf.muDirt,
        powerToWeight: (perf.powerW / 745.7) / (perf.mass / 1000)
    };
}

/** 0-100 rating bars shown in the UI. Purely presentational. */
export function ratingBars(perf) {
    const h = headlineStats(perf);
    const pct = (v, lo, hi) => Math.round(clamp((v - lo) / (hi - lo), 0, 1) * 100);
    return {
        speed: pct(h.topSpeedKmh, 130, 400),
        accel: pct(1 / h.zeroToHundred, 1 / 13, 1 / 2.4),
        handling: pct(h.lateralG, 0.8, 2.0),
        braking: pct(h.brakeG, 0.75, 1.75),
        dirt: pct(h.dirtGrip, 0.4, 1.0)
    };
}
