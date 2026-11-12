// Game state: one plain object, saved to localStorage as JSON.
//
// Everything the player owns or has done lives in `state`. UI code reads it
// directly and calls the functions in src/game/* to change it; those call
// commit() which saves and tells the UI to redraw.

import { CARS } from '../data/cars.js';
import { findUpgrade } from '../data/upgrades.js';

export const SAVE_KEY = 'projectRedlineSaveV2';
const LEGACY_SAVE_KEY = 'projectRedlineSaveV1';
export const SAVE_VERSION = 5;
export const STARTING_MONEY = 4000;

export function createNewState(name = 'Driver') {
    return {
        version: SAVE_VERSION,
        createdAt: Date.now(),
        name,
        money: STARTING_MONEY,
        xp: 0,
        level: 1,
        skills: {},
        cars: [],
        selectedCarUid: null,
        nextCarUid: 1,
        career: {
            unlockedLeagues: ['D'],
            results: {},      // eventId -> { order: [driverId], bestPos, attempts, lastPos }
            rivals: {},       // leagueId -> rivalId -> { money, items: [upgradeId] }
            intel: [],        // newest last: { leagueId, rivalId, text }
            champions: {}     // leagueId -> true once the bonus was paid
        },
        records: {},          // trackKey -> { lap, carName, at }
        stats: {
            races: 0, wins: 0, podiums: 0, distanceKm: 0, overtakes: 0, perfectLaunches: 0,
            upgradesBought: 0, earnings: 0, bestWinStreak: 0, winStreak: 0
        },
        achievements: {},     // id -> timestamp
        daily: { doneDay: null, streak: 0, lastDay: null },
        dealer: { boughtOffers: [] },
        settings: { sound: true, difficulty: 'normal', camera: 'follow' },
        flags: { seenHowTo: false }
    };
}

export let state = createNewState();

const listeners = new Set();
let storage = typeof localStorage !== 'undefined' ? localStorage : null;

/** Tests swap in a fake storage. */
export function setStorage(fake) { storage = fake; }

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function save() {
    if (!storage) return;
    try {
        storage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('Could not save game state:', error);
    }
}

/** Save and notify the UI. Call after every state change. */
export function commit(reason = 'change') {
    save();
    listeners.forEach(fn => fn(reason));
}

export function replaceState(next) {
    state = next;
}

/** Fill in anything missing so old or hand-edited saves never crash the game. */
export function normalizeState(raw) {
    const base = createNewState();
    const out = { ...base, ...raw };
    out.name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 24) : 'Driver';
    out.money = Number.isFinite(raw.money) ? Math.max(0, Math.round(raw.money)) : base.money;
    out.xp = Number.isFinite(raw.xp) ? Math.max(0, raw.xp) : 0;
    out.level = Number.isFinite(raw.level) ? Math.max(1, Math.floor(raw.level)) : 1;
    out.skills = raw.skills && typeof raw.skills === 'object' ? { ...raw.skills } : {};
    out.career = { ...base.career, ...(raw.career || {}) };
    if (!Array.isArray(out.career.unlockedLeagues) || !out.career.unlockedLeagues.length) out.career.unlockedLeagues = ['D'];
    ['results', 'rivals', 'champions'].forEach(key => {
        if (!out.career[key] || typeof out.career[key] !== 'object') out.career[key] = {};
    });
    if (!Array.isArray(out.career.intel)) out.career.intel = [];
    out.records = raw.records && typeof raw.records === 'object' ? raw.records : {};
    out.stats = { ...base.stats, ...(raw.stats || {}) };
    out.achievements = raw.achievements && typeof raw.achievements === 'object' ? raw.achievements : {};
    out.daily = { ...base.daily, ...(raw.daily || {}) };
    out.dealer = { ...base.dealer, ...(raw.dealer || {}) };
    out.settings = { ...base.settings, ...(raw.settings || {}) };
    out.flags = { ...base.flags, ...(raw.flags || {}) };

    out.cars = (Array.isArray(raw.cars) ? raw.cars : [])
        .filter(car => car && (car.spec || CARS.some(model => model.id === car.modelId)))
        .map(car => ({
            uid: car.uid,
            modelId: car.modelId,
            spec: car.spec || null,
            color: car.color || null,
            owned: Array.isArray(car.owned) ? car.owned.filter(id => findUpgrade(id)) : [],
            equipped: car.equipped && typeof car.equipped === 'object' ? { ...car.equipped } : {},
            condition: {
                engine: clampPct(car.condition?.engine),
                tires: clampPct(car.condition?.tires),
                suspension: clampPct(car.condition?.suspension)
            },
            races: car.races || 0,
            wins: car.wins || 0
        }));
    out.nextCarUid = Math.max(Number(raw.nextCarUid) || 1, ...out.cars.map(c => (Number(c.uid) || 0) + 1));
    if (!out.cars.some(c => c.uid === out.selectedCarUid)) out.selectedCarUid = out.cars[0]?.uid ?? null;
    out.version = SAVE_VERSION;
    return out;
}

function clampPct(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 100;
}

/**
 * The pre-1.0 prototype saved a different shape. Carry over what still makes
 * sense (name, money, the three starter cars and their parts) and start the
 * career fresh, because events and physics changed completely.
 */
export function migrateLegacySave(old) {
    const pd = old?.playerData;
    if (!pd) return null;
    const next = createNewState(typeof pd.name === 'string' ? pd.name : 'Driver');
    next.money = Math.max(STARTING_MONEY, Math.min(60000, Math.round(Number(pd.money) || 0)));
    const ownedIds = Array.isArray(pd.ownedCars) ? pd.ownedCars : [];
    ownedIds.filter(id => ['c1', 'c2', 'c3'].includes(id)).forEach(modelId => {
        const owned = (old.carsUpgrades?.[modelId] || []).filter(id => findUpgrade(id));
        const equipped = {};
        owned.forEach(id => {
            const found = findUpgrade(id);
            const current = equipped[found.category.id] ? findUpgrade(equipped[found.category.id]) : null;
            if (!current || found.stage > current.stage) equipped[found.category.id] = id;
        });
        next.cars.push({
            uid: next.nextCarUid++, modelId, spec: null, color: null, owned, equipped,
            condition: { engine: 100, tires: 100, suspension: 100 }, races: 0, wins: 0
        });
    });
    next.selectedCarUid = next.cars[0]?.uid ?? null;
    next.flags.migratedFromPrototype = true;
    return next;
}

/** @returns {'loaded' | 'migrated' | 'new'} */
export function loadState() {
    if (!storage) { state = createNewState(); return 'new'; }
    try {
        const raw = storage.getItem(SAVE_KEY);
        if (raw) {
            state = normalizeState(JSON.parse(raw));
            return 'loaded';
        }
        const legacy = storage.getItem(LEGACY_SAVE_KEY);
        if (legacy) {
            const migrated = migrateLegacySave(JSON.parse(legacy));
            if (migrated) {
                state = normalizeState(migrated);
                save();
                return 'migrated';
            }
        }
    } catch (error) {
        console.warn('Could not load save, starting fresh:', error);
    }
    state = createNewState();
    return 'new';
}

export function resetState(name) {
    state = createNewState(name);
    if (storage) {
        try { storage.removeItem(LEGACY_SAVE_KEY); } catch { /* ignore */ }
    }
    commit('reset');
}

export function exportSave() {
    return JSON.stringify(state);
}

export function importSave(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.cars)) throw new Error('Not a Project Redline save file.');
    state = normalizeState(parsed);
    commit('import');
}
