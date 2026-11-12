// Race session: grid, start lights, per-car physics, traffic, tyres, nitro,
// mistakes, lap counting and classification.
//
// The simulation always advances in fixed steps of DT seconds, so a race
// behaves identically at 1x, 4x or when skipped to the end.

import { createRng, clamp, lerp, randRange } from '../core/rng.js';
import { sampleIndex } from './track.js';
import { G, AIR_DENSITY, gripOn, rollingResistance } from './vehicle.js';
import { computeProfile, RACING_LINE_FACTOR } from './profile.js';

export const DT = 1 / 60;
const CAR_LENGTH = 4.4;
const CAR_WIDTH = 2.0;
const DRAFT_RANGE = 34;

export const PACE_MODES = {
    save: { id: 'save', label: 'Save', speed: 0.982, wear: 0.50, mistake: 0.35 },
    race: { id: 'race', label: 'Race', speed: 1.0, wear: 1.0, mistake: 1.0 },
    push: { id: 'push', label: 'Push', speed: 1.013, wear: 1.85, mistake: 2.4 }
};

/** Tyre grip multiplier for a wear level 0..1: gentle fade, then a cliff. */
export function tyreGripFactor(wear) {
    const fade = 0.10 * Math.pow(clamp(wear, 0, 1), 1.4);
    const cliff = wear > 0.85 ? (wear - 0.85) * 0.6 : 0;
    return 1 - fade - cliff;
}

function gripLeft(lateral, lateralMax) {
    const used = Math.min(1, lateral / Math.max(0.01, lateralMax));
    return Math.sqrt(Math.max(0.04, 1 - used * used));
}

/**
 * @param {object} config
 *   track    built track (see sim/track.js)
 *   laps     number of laps
 *   entries  grid order, pole first. Each entry:
 *            { id, name, carName, color, body, isPlayer, perf,
 *              driver: { skill, aggression, consistency, tyreCare, launch } }
 *   seed     number, makes the race reproducible
 */
export function createRace(config) {
    const { track, laps } = config;
    const rng = createRng(config.seed >>> 0);
    const halfUsable = Math.max(1.5, track.width / 2 - 1.3);

    const cars = config.entries.map((entry, slot) => {
        const profile = computeProfile(track, entry.perf);
        const gridS = -(9 + slot * 8.5);
        return {
            entry,
            id: entry.id,
            isPlayer: !!entry.isPlayer,
            perf: entry.perf,
            driver: entry.driver,
            limit: profile.limit,
            idealLap: profile.lapTime,
            gridSlot: slot + 1,
            s: gridS,
            dist: gridS,
            v: 0,
            lat: slot % 2 === 0 ? -0.42 : 0.42,
            targetLat: slot % 2 === 0 ? -0.42 : 0.42,
            gear: 0,
            rpm: entry.perf.idleRpm,
            shiftTimer: 0,
            throttle: 0,
            brake: 0,
            nitro: 1,
            nitroActive: false,
            tyreWear: 0,
            pace: 'race',
            lap: 0,
            lapStartTime: 0,
            lastLap: 0,
            bestLap: 0,
            lapTimes: [],
            finished: false,
            finishTime: 0,
            position: slot + 1,
            reaction: 0,
            launched: false,
            launchBoost: 0,
            mistakeTimer: 0,
            mistakeCooldown: 0,
            wasBraking: false,
            slide: 0,
            drafting: 0,
            gapAhead: 0,
            gapBehind: 0,
            topSpeed: 0,
            overtakes: 0,
            mistakes: 0,
            nitroSpent: 0,
            nitroPlan: randRange(rng, 0.0, 0.25)
        };
    });

    const race = {
        track,
        laps,
        cars,
        rng,
        phase: 'countdown',
        clock: 0, // negative until the lights go out (set below)
        lightsStartClock: 0,
        lightsOn: 0,
        time: 0,
        feed: [],
        leaderFinished: false,
        finishOrder: [],
        fastestLap: null,
        // Tyre life scales with race distance so every race ends in a similar wear window.
        wearScale: 150 / Math.max(40, laps * (cars.reduce((sum, c) => sum + c.idealLap, 0) / cars.length)),
        player: cars.find(c => c.isPlayer) || null,
        input: { nitro: false, pace: 'race', auto: false },
        launch: { pressedAt: null, jump: false, rating: null, reaction: null },
        order: [...cars],
        halfUsable
    };

    race.clock = -(3.0 + randRange(rng, 0.7, 1.8));
    race.lightsStartClock = race.clock;

    // Reaction times are rolled up front so the result does not depend on frame timing.
    cars.forEach(car => {
        const launchSkill = clamp(car.driver.launch ?? 0.5, 0, 1);
        car.reaction = randRange(rng, 0.18, 0.46) * (1.25 - 0.5 * launchSkill);
    });

    return race;
}

function say(race, type, text, car) {
    race.feed.push({ time: race.time, type, text, carId: car ? car.id : null });
    if (race.feed.length > 60) race.feed.shift();
}

/** Player presses the launch control (Space) around the start. */
export function pressLaunch(race) {
    if (race.phase !== 'countdown' && !(race.phase === 'racing' && race.time < 0.6)) return;
    const player = race.player;
    if (!player || race.launch.pressedAt !== null) return;
    race.launch.pressedAt = race.clock;

    if (race.clock < 0) {
        if (race.clock > -0.9) {
            race.launch.jump = true;
            race.launch.rating = 'jump';
            player.reaction = 1.0;
            say(race, 'bad', 'Jump start! Held on the line.', player);
        } else {
            race.launch.pressedAt = null; // far too early: ignore, let them try again
        }
        return;
    }

    const reaction = Math.max(0.07, race.clock);
    player.reaction = reaction;
    race.launch.reaction = reaction;
    if (reaction <= 0.2) {
        race.launch.rating = 'perfect';
        player.launchBoost = 2.2;
        say(race, 'good', `Perfect launch! (${reaction.toFixed(2)}s)`, player);
    } else if (reaction <= 0.36) {
        race.launch.rating = 'good';
        player.launchBoost = 1.0;
        say(race, 'good', `Good launch (${reaction.toFixed(2)}s)`, player);
    } else {
        race.launch.rating = 'late';
    }
}

function circularGap(track, fromS, toS) {
    const L = track.length;
    return (((toS - fromS) % L) + L) % L;
}

function lateralOverlap(race, a, b) {
    return Math.abs(a.lat - b.lat) * race.halfUsable < CAR_WIDTH + 0.15;
}

function findNeighbours(race, car) {
    let ahead = null;
    let aheadGap = Infinity;
    let behindGap = Infinity;
    for (const other of race.cars) {
        if (other === car || other.finished) continue;
        const gap = circularGap(race.track, car.s, other.s) - CAR_LENGTH;
        if (gap < aheadGap) { aheadGap = gap; ahead = other; }
        const back = circularGap(race.track, other.s, car.s) - CAR_LENGTH;
        if (back < behindGap) behindGap = back;
    }
    return { ahead, aheadGap, behindGap };
}

function aiWantsNitro(race, car, vTarget, aheadGap, behindGap) {
    if (car.nitro <= 0.02 || car.throttle < 0.95 || car.shiftTimer > 0) return false;
    if (car.v < 13 || car.v > car.perf.vTop * 0.95) return false;
    const track = race.track;
    // Only on a proper straight: no braking needed for the next ~110 m.
    const f = Math.sqrt(tyreGripFactor(car.tyreWear)) * car.driver.skill;
    if (car.limit[sampleIndex(track, car.s + 45)] * f < car.v + 4) return false;
    if (car.limit[sampleIndex(track, car.s + 110)] * f < car.v + 7) return false;
    // Spread the bottle over the race; fighters and the final lap spend freely.
    const progress = clamp(car.dist / (track.length * race.laps), 0, 1);
    const allowance = 1 - clamp(progress * 1.15 + car.nitroPlan + car.driver.aggression * 0.15, 0, 1);
    const fighting = aheadGap < 22 || behindGap < 14;
    const lastLap = car.lap >= race.laps - 1;
    return car.nitro > allowance || (fighting && car.nitro > allowance * 0.6) || lastLap;
}

function stepCar(race, car, dt) {
    const track = race.track;
    const perf = car.perf;

    if (!car.launched) {
        if (race.time < car.reaction) {
            car.rpm = lerp(car.rpm, perf.redline * 0.55, 0.2);
            return;
        }
        car.launched = true;
    }

    const idx = sampleIndex(track, car.s);
    const curvature = track.curvature[idx];
    const kAbs = Math.abs(curvature);
    const kEff = kAbs * RACING_LINE_FACTOR;
    const dirt = track.dirt[idx];
    const pace = PACE_MODES[car.pace] || PACE_MODES.race;

    car.mistakeTimer = Math.max(0, car.mistakeTimer - dt);
    car.mistakeCooldown = Math.max(0, car.mistakeCooldown - dt);
    car.launchBoost = Math.max(0, car.launchBoost - dt);

    const gripScale = tyreGripFactor(car.tyreWear) * (car.mistakeTimer > 0 ? 0.84 : 1);
    const offLine = 1 - 0.04 * Math.abs(car.lat) * clamp(kAbs * 60, 0, 1);
    const speedFactor = Math.sqrt(tyreGripFactor(car.tyreWear)) * car.driver.skill * pace.speed * offLine;

    // ── Target speed from the pre-solved limit curve ─────────────────────────
    const lookIdx = sampleIndex(track, car.s + car.v * 0.07 + 1);
    let vTarget = car.limit[lookIdx] * speedFactor;
    const vFree = vTarget;

    // ── Traffic: slipstream, blocking and overtaking ─────────────────────────
    const { ahead, aheadGap, behindGap } = findNeighbours(race, car);
    car.drafting = 0;
    if (ahead && aheadGap < DRAFT_RANGE && car.v > 18) {
        const aligned = Math.abs(car.lat - ahead.lat) * race.halfUsable < 3.2;
        if (aligned) car.drafting = clamp(1 - aheadGap / DRAFT_RANGE, 0, 1);
    }

    if (ahead && aheadGap < 16) {
        const closing = vFree > ahead.v + 0.6 || car.v > ahead.v + 0.5;
        if (closing && lateralOverlap(race, car, ahead)) {
            // Pick a side: the inside of the next corner if it is free, else the other side.
            const upcoming = track.curvature[sampleIndex(track, car.s + 40)];
            let side = Math.abs(upcoming) > 0.004 ? Math.sign(upcoming) : (ahead.lat >= 0 ? -1 : 1);
            if (Math.abs(ahead.lat - side * 0.62) * race.halfUsable < CAR_WIDTH + 0.4) side = -side;
            car.targetLat = side * 0.62;
        }
        if (lateralOverlap(race, car, ahead)) {
            const follow = ahead.v + (aheadGap - 1.6) * 1.1;
            if (follow < vTarget) vTarget = Math.max(0, follow);
        }
    } else if (behindGap > 7 && (!ahead || aheadGap > 9)) {
        car.targetLat = 0;
    }
    const latStep = 0.85 * dt;
    car.lat += clamp(car.targetLat - car.lat, -latStep, latStep);

    // ── Mistakes: rolled once per braking zone ───────────────────────────────
    const isBraking = car.v > vTarget + 0.4;
    if (isBraking && !car.wasBraking && car.mistakeCooldown <= 0 && car.v > 16 && race.time > 6) {
        const cornerMin = car.limit[sampleIndex(track, car.s + 60)] * speedFactor;
        if (car.v - cornerMin > 5) {
            car.mistakeCooldown = 5;
            const pressure = behindGap < 9 ? 1.4 : 1;
            const chance = 0.034 * (1 - 0.82 * clamp(car.driver.consistency, 0, 1)) * pace.mistake * (1 + 1.6 * car.tyreWear) * pressure;
            if (race.rng() < chance) {
                car.mistakeTimer = 1.5;
                car.mistakes++;
                const corner = track.cornerIndexAt[sampleIndex(track, car.s + 60)];
                const where = corner >= 0 ? ` into Turn ${corner + 1}` : '';
                say(race, car.isPlayer ? 'bad' : 'info', `${car.entry.name} locks up${where}!`, car);
            }
        }
    }
    car.wasBraking = isBraking;

    // ── Forces ───────────────────────────────────────────────────────────────
    const mu = gripOn(perf, dirt) * gripScale;
    const tyreMax = mu * (G + (0.5 * AIR_DENSITY * perf.clA * car.v * car.v) / perf.mass);
    const lateralDemand = car.v * car.v * kEff;
    const longGrip = gripLeft(lateralDemand, tyreMax);
    const dragForce = 0.5 * AIR_DENSITY * perf.cdA * car.v * car.v * (1 - 0.34 * car.drafting);
    const resist = dragForce / perf.mass + rollingResistance(dirt) * G;

    // Gearbox
    if (car.shiftTimer > 0) car.shiftTimer -= dt;
    if (car.shiftTimer <= 0) {
        if (car.gear < perf.gearCount - 1 && car.v >= perf.upshiftSpeed[car.gear] && !isBraking) {
            car.gear++;
            car.shiftTimer = perf.shiftTime;
        } else if (car.gear > 0 && car.v < perf.upshiftSpeed[car.gear - 1] * 0.9) {
            car.gear--;
            car.shiftTimer = isBraking ? 0 : perf.shiftTime * 0.5;
        }
    }

    const cornerLimitNow = car.limit[idx] * Math.sqrt(gripScale) * 1.07;
    const overspeed = kAbs > 0.006 && car.v > cornerLimitNow;

    if (isBraking) {
        const brakeMax = Math.min(perf.brakeG * G, tyreMax * 1.02 * longGrip) + resist;
        const wanted = (car.v - vTarget) / dt;
        const decel = Math.min(wanted, brakeMax);
        car.v = Math.max(0, car.v - decel * dt);
        car.brake = clamp(decel / brakeMax, 0, 1);
        car.throttle = 0;
        car.nitroActive = false;
    } else {
        car.brake = 0;
        car.throttle = 1;
        const wantsNitro = (car.isPlayer && !race.input.auto) ? race.input.nitro : aiWantsNitro(race, car, vTarget, aheadGap, behindGap);
        car.nitroActive = wantsNitro && car.nitro > 0 && car.shiftTimer <= 0 && car.v > 2;

        let drive = 0;
        if (car.shiftTimer <= 0) {
            drive = perf.wheelForce(Math.max(0.5, car.v), car.gear) / perf.mass;
            if (car.nitroActive) drive *= 1 + perf.nitroPower;
        }
        const traction = tyreMax * 1.05 * perf.driveFrac * longGrip * (car.launchBoost > 0 ? 1.08 : 1);
        const accel = Math.min(drive, traction) - resist;
        const next = car.v + accel * dt;
        if (next > vTarget) {
            car.throttle = accel > 0 ? clamp((vTarget - car.v) / (accel * dt), 0.05, 1) : 0.05;
            car.v = Math.max(car.v, vTarget);
        } else {
            car.v = Math.max(0, next);
        }
        if (car.nitroActive) {
            car.nitro = Math.max(0, car.nitro - dt / perf.nitroCap);
            car.nitroSpent += dt;
        }
    }
    car.nitro = Math.min(1, car.nitro + car.drafting * 0.02 * dt);

    // Running wide: scrub speed, drift to the outside, cook the tyres.
    if (overspeed) {
        car.v = Math.max(0, car.v - 3.2 * dt);
        car.slide = Math.min(1, car.slide + dt * 4);
        car.targetLat = clamp(car.lat - Math.sign(curvature) * 0.5, -0.9, 0.9);
    } else {
        const cornerLoad = tyreMax > 0 ? clamp(lateralDemand / tyreMax, 0, 1) : 0;
        const wantSlide = cornerLoad > 0.9 && car.v > 14 ? (cornerLoad - 0.9) * 4 : 0;
        car.slide += (wantSlide - car.slide) * Math.min(1, dt * 5);
    }

    // ── Tyres ────────────────────────────────────────────────────────────────
    const load = tyreMax > 0 ? clamp(lateralDemand / tyreMax, 0, 1) : 0;
    const wearRate = 0.0043 * race.wearScale * (0.25 + load * load * 1.5 + car.brake * 0.35 + (overspeed ? 2.5 : 0) + (car.nitroActive ? 0.3 : 0))
        * pace.wear * (car.driver.tyreCare ?? 1) * lerp(1, 0.75, dirt);
    car.tyreWear = Math.min(1, car.tyreWear + wearRate * dt);

    // ── Telemetry ────────────────────────────────────────────────────────────
    const mechRpm = perf.rpmAt(car.v, car.gear);
    const targetRpm = mechRpm < 2200 && car.throttle > 0.5 ? Math.min(perf.redline * 0.55, 3800) : mechRpm;
    car.rpm = clamp(lerp(car.rpm, Math.max(perf.idleRpm, targetRpm), Math.min(1, dt * 18)), perf.idleRpm, perf.redline);
    if (car.v > car.topSpeed) car.topSpeed = car.v;

    // ── Move + lap counting ──────────────────────────────────────────────────
    const move = car.v * dt;
    car.s += move;
    car.dist += move;
    if (car.s >= track.length) car.s -= track.length;

    const lapsDone = Math.floor(car.dist / track.length);
    if (car.dist >= 0 && lapsDone > car.lap) {
        car.lap = lapsDone;
        const lapTime = race.time - car.lapStartTime;
        car.lapStartTime = race.time;
        car.lastLap = lapTime;
        car.lapTimes.push(lapTime);
        if (!car.bestLap || lapTime < car.bestLap) car.bestLap = lapTime;
        // Lap 1 includes the standing start, so it never counts as a fastest lap.
        if (car.lap > 1 && (!race.fastestLap || lapTime < race.fastestLap.time)) {
            race.fastestLap = { time: lapTime, carId: car.id, name: car.entry.name };
            if (race.laps > 2) say(race, car.isPlayer ? 'good' : 'info', `Fastest lap: ${car.entry.name} ${lapTime.toFixed(2)}s`, car);
        }
        if (car.lap >= race.laps || race.leaderFinished) {
            car.finished = true;
            car.finishTime = race.time;
            car.nitroActive = false;
            race.finishOrder.push(car);
            if (!race.leaderFinished) {
                race.leaderFinished = true;
                say(race, car.isPlayer ? 'good' : 'info', `${car.entry.name} takes the chequered flag!`, car);
            }
        } else if (car.isPlayer && car.lap === race.laps - 1) {
            say(race, 'info', 'Final lap!', car);
        }
    }
}

function updateOrder(race) {
    const running = race.cars.filter(c => !c.finished).sort((a, b) => b.dist - a.dist);
    const order = [...race.finishOrder, ...running];
    order.forEach((car, i) => {
        const newPos = i + 1;
        if (race.time > 3 && newPos < car.position && !car.finished) {
            car.overtakes += car.position - newPos;
            if (car.isPlayer || order[i + 1]?.isPlayer) {
                const loser = order[i + 1];
                if (loser && race.time > 4) {
                    say(race, car.isPlayer ? 'good' : 'bad', `${car.entry.name} passes ${loser.entry.name} for P${newPos}`, car);
                }
            }
        }
        car.position = newPos;
    });
    for (let i = 0; i < order.length; i++) {
        const car = order[i];
        const front = order[i - 1];
        const back = order[i + 1];
        car.gapAhead = front && !car.finished ? (front.finished ? 0 : (front.dist - car.dist) / Math.max(8, car.v)) : 0;
        car.gapBehind = back && !car.finished ? (car.dist - back.dist) / Math.max(8, back.v) : 0;
    }
    race.order = order;
}

/** Advance the race by exactly one fixed step. */
export function stepRace(race) {
    if (race.phase === 'finished') return;
    race.clock += DT;

    if (race.phase === 'countdown') {
        // Five red lights come on one by one, then all go out at clock = 0.
        const sinceStart = race.clock - race.lightsStartClock;
        race.lightsOn = race.clock >= 0 ? 0 : clamp(Math.floor(sinceStart / 0.6) + 1, 0, 5);
        if (race.clock >= 0) {
            race.phase = 'racing';
            race.time = race.clock;
            race.lightsOn = 0;
        }
        return;
    }

    race.time = race.clock;
    if (race.player) {
        race.player.pace = race.input.pace;
        // No press at all: the car leaves on its own, a little late.
        if (race.launch.pressedAt === null && race.time > 0.6 && !race.launch.rating) {
            race.launch.rating = 'auto';
        }
    }

    for (const car of race.cars) {
        if (!car.finished) stepCar(race, car, DT);
    }
    updateOrder(race);

    if (race.leaderFinished) {
        race.sinceLeader = (race.sinceLeader || 0) + DT;
        // Safety net: nobody waits more than 90 s for backmarkers.
        if (race.sinceLeader > 90) {
            race.cars.filter(c => !c.finished).sort((a, b) => b.dist - a.dist).forEach(car => {
                car.finished = true;
                car.finishTime = race.time;
                race.finishOrder.push(car);
            });
        }
    }
    if (race.cars.every(c => c.finished)) {
        race.phase = 'finished';
        updateOrder(race);
    }
}

/** Run the rest of the race instantly. The player car drives itself. */
export function simulateToEnd(race, maxSeconds = 3600) {
    race.input.auto = true;
    race.input.nitro = false;
    let guard = Math.ceil(maxSeconds / DT);
    while (race.phase !== 'finished' && guard-- > 0) stepRace(race);
    return race;
}

/** Final classification, best first. */
export function classify(race) {
    const winner = race.finishOrder[0];
    return race.order.map((car, i) => {
        const lapsDown = winner ? winner.lap - car.lap : 0;
        return {
            position: i + 1,
            id: car.id,
            name: car.entry.name,
            carName: car.entry.carName,
            color: car.entry.color,
            isPlayer: car.isPlayer,
            gridSlot: car.gridSlot,
            totalTime: car.finishTime,
            gap: i === 0 ? 0 : car.finishTime - winner.finishTime,
            lapsDown,
            bestLap: car.bestLap,
            lapTimes: [...car.lapTimes],
            topSpeedKmh: car.topSpeed * 3.6,
            overtakes: car.overtakes,
            mistakes: car.mistakes,
            tyreWear: car.tyreWear
        };
    });
}
