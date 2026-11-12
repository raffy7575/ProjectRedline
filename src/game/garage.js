// Garage actions: buying and selling cars, fitting parts, repairs, paint.
// Every function returns { ok: true } or { ok: false, reason } and never throws
// for normal "can't afford it" situations.

import { state, commit } from '../core/store.js';
import { CARS, CLASS_INFO } from '../data/cars.js';
import { findUpgrade } from '../data/upgrades.js';
import { getCarSpec, upgradeCost, carSellValue } from './performance.js';

const fail = (reason) => ({ ok: false, reason });

export function getSelectedCar() {
    return state.cars.find(car => car.uid === state.selectedCarUid) || null;
}

export function getCar(uid) {
    return state.cars.find(car => car.uid === uid) || null;
}

export function carDisplayColor(car) {
    return car.color || getCarSpec(car).color;
}

function addCar(modelId, spec = null) {
    const car = {
        uid: state.nextCarUid++,
        modelId,
        spec,
        color: null,
        owned: [],
        equipped: {},
        condition: { engine: 100, tires: 100, suspension: 100 },
        races: 0,
        wins: 0
    };
    state.cars.push(car);
    state.selectedCarUid = car.uid;
    return car;
}

export function buyCar(modelId) {
    const model = CARS.find(c => c.id === modelId);
    if (!model) return fail('Unknown car.');
    if (state.money < model.price) return fail('Not enough money.');
    state.money -= model.price;
    const car = addCar(modelId);
    commit('buy-car');
    return { ok: true, car };
}

/** Special-offer cars carry their whole spec with them. */
export function buyOfferCar(offer) {
    if (state.dealer.boughtOffers.includes(offer.id)) return fail('Already bought.');
    if (state.money < offer.price) return fail('Not enough money.');
    state.money -= offer.price;
    state.dealer.boughtOffers.push(offer.id);
    state.dealer.boughtOffers = state.dealer.boughtOffers.slice(-40);
    const car = addCar(offer.spec.baseModelId, { ...offer.spec });
    commit('buy-car');
    return { ok: true, car };
}

export function sellCar(uid) {
    const car = getCar(uid);
    if (!car) return fail('Unknown car.');
    if (state.cars.length <= 1) return fail('You cannot sell your only car.');
    const value = carSellValue(car);
    state.money += value;
    state.cars = state.cars.filter(c => c.uid !== uid);
    if (state.selectedCarUid === uid) state.selectedCarUid = state.cars[0].uid;
    commit('sell-car');
    return { ok: true, value };
}

export function selectCar(uid) {
    if (!getCar(uid)) return fail('Unknown car.');
    state.selectedCarUid = uid;
    commit('select-car');
    return { ok: true };
}

export function paintCar(uid, color) {
    const car = getCar(uid);
    if (!car) return fail('Unknown car.');
    const cost = 250;
    if (carDisplayColor(car) === color) return { ok: true };
    if (state.money < cost) return fail('Not enough money.');
    state.money -= cost;
    car.color = color;
    commit('paint');
    return { ok: true };
}

/** Buy a part (and fit it). Staged parts need the previous stage first. */
export function buyUpgrade(uid, itemId) {
    const car = getCar(uid);
    const found = findUpgrade(itemId);
    if (!car || !found) return fail('Unknown part.');
    if (car.owned.includes(itemId)) return fail('Already owned.');
    const { category, stage, item } = found;
    if (category.mode === 'staged' && stage > 0 && !car.owned.includes(category.items[stage - 1].id)) {
        return fail(`Install ${category.items[stage - 1].name} first.`);
    }
    const cost = upgradeCost(car, item);
    if (state.money < cost) return fail('Not enough money.');
    state.money -= cost;
    car.owned.push(itemId);
    car.equipped[category.id] = itemId;
    state.stats.upgradesBought++;
    commit('buy-upgrade');
    return { ok: true, cost };
}

/** Fit an owned part, or pass null to go back to stock for that category. */
export function equipUpgrade(uid, categoryId, itemId) {
    const car = getCar(uid);
    if (!car) return fail('Unknown car.');
    if (itemId === null) {
        delete car.equipped[categoryId];
    } else {
        const found = findUpgrade(itemId);
        if (!found || found.category.id !== categoryId) return fail('Unknown part.');
        if (found.item.cost > 0 && !car.owned.includes(itemId)) return fail('Part not owned.');
        if (found.item.cost === 0) delete car.equipped[categoryId];
        else car.equipped[categoryId] = itemId;
    }
    commit('equip');
    return { ok: true };
}

// ── Wear & maintenance ───────────────────────────────────────────────────────

const REPAIR_RATE = { engine: 22, tires: 12, suspension: 16 }; // $ per missing % in Class D

export function repairCost(car, component) {
    const mul = CLASS_INFO[getCarSpec(car).cls]?.serviceMul || 1;
    const missing = Math.max(0, 100 - car.condition[component]);
    return Math.ceil(missing * REPAIR_RATE[component] * mul);
}

export function fullServiceCost(car) {
    return repairCost(car, 'engine') + repairCost(car, 'tires') + repairCost(car, 'suspension');
}

export function repair(uid, component) {
    const car = getCar(uid);
    if (!car) return fail('Unknown car.');
    const parts = component === 'all' ? ['engine', 'tires', 'suspension'] : [component];
    const cost = parts.reduce((sum, part) => sum + repairCost(car, part), 0);
    if (cost <= 0) return fail('Nothing to repair.');
    if (state.money < cost) return fail('Not enough money.');
    state.money -= cost;
    parts.forEach(part => { car.condition[part] = 100; });
    commit('repair');
    return { ok: true, cost };
}

/** Wear from one race. `tyreWear` is the in-race wear (0..1) of the set used. */
export function applyRaceWear(car, { tyreWear, dirtShare, raceKm }) {
    const distance = Math.max(0.5, raceKm / 5);
    const wear = {
        engine: 1.6 * distance,
        tires: (2 + tyreWear * 7) * distance,
        suspension: (1.2 + dirtShare * 2.4) * distance
    };
    Object.keys(wear).forEach(part => {
        car.condition[part] = Math.max(0, car.condition[part] - wear[part]);
    });
    return wear;
}
