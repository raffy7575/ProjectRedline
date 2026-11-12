// Performance Index (PI): one number that says how fast a car really is.
//
// Instead of a hand-made formula, PI is measured: we solve the car's ideal lap
// on a reference circuit and convert the average speed into points. Leagues
// cap PI, so tuning is about finding the fastest build under the limit.

import { CARS, CLASS_INFO, CAR_CLASSES } from '../data/cars.js';
import { UPGRADE_CATEGORIES, findUpgrade } from '../data/upgrades.js';
import { getTrackDef } from '../data/tracks.js';
import { buildTrack } from '../sim/track.js';
import { applyEffects, derivePerf } from '../sim/vehicle.js';
import { computeProfile } from '../sim/profile.js';

let referenceTrack = null;
const piCache = new Map();

function getReferenceTrack() {
    if (!referenceTrack) referenceTrack = buildTrack(getTrackDef('t1'));
    return referenceTrack;
}

/** Base spec sheet for an owned car (special-offer cars carry their own). */
export function getCarSpec(car) {
    return car.spec || CARS.find(model => model.id === car.modelId);
}

/** Effects of the parts currently fitted. */
export function getEquippedEffects(car) {
    return Object.values(car.equipped || {})
        .map(itemId => findUpgrade(itemId)?.item.fx)
        .filter(Boolean);
}

/** Spec with fitted parts applied. `overrideEquipped` previews another setup. */
export function getTunedSpec(car, overrideEquipped) {
    const view = overrideEquipped ? { ...car, equipped: overrideEquipped } : car;
    return applyEffects(getCarSpec(car), getEquippedEffects(view));
}

export function specToPI(tunedSpec) {
    const key = [tunedSpec.hp, tunedSpec.weight, tunedSpec.grip, tunedSpec.brake, tunedSpec.cdA, tunedSpec.clA,
        tunedSpec.redline, tunedSpec.gears, tunedSpec.drivetrain, tunedSpec.shiftTimeMul].map(v => typeof v === 'number' ? v.toFixed(3) : v).join('|');
    if (piCache.has(key)) return piCache.get(key);
    const track = getReferenceTrack();
    const perf = derivePerf(tunedSpec);
    const lap = computeProfile(track, perf).lapTime;
    const avgSpeed = track.length / lap;
    const pi = Math.round((avgSpeed - 19) * 25);
    piCache.set(key, pi);
    return pi;
}

export function getCarPI(car, overrideEquipped) {
    return specToPI(getTunedSpec(car, overrideEquipped));
}

/** Simulation-ready numbers including wear and driver skills. */
export function getCarPerf(car, skills = {}, useCondition = true) {
    return derivePerf(getTunedSpec(car), {
        condition: useCondition ? car.condition : undefined,
        skills
    });
}

/** Letter class a PI value falls into (for badges). */
export function classForPI(pi) {
    for (const cls of CAR_CLASSES) {
        if (pi <= CLASS_INFO[cls].piCap) return cls;
    }
    return 'S';
}

export function upgradeCost(car, item) {
    const spec = getCarSpec(car);
    const mul = CLASS_INFO[spec.cls]?.upgradeCostMul || 1;
    return Math.round((item.cost * mul) / 50) * 50;
}

/** What the car is worth when sold: 55% of the car plus 35% of its parts. */
export function carSellValue(car) {
    const spec = getCarSpec(car);
    const parts = (car.owned || []).reduce((sum, id) => {
        const found = findUpgrade(id);
        return found ? sum + upgradeCost(car, found.item) : sum;
    }, 0);
    return Math.round((spec.price * 0.55 + parts * 0.35) / 50) * 50;
}

export { UPGRADE_CATEGORIES };
