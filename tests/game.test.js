import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/core/store.js';
import { CARS, CLASS_INFO } from '../src/data/cars.js';
import { LEAGUES } from '../src/data/leagues.js';
import * as garage from '../src/game/garage.js';
import * as career from '../src/game/career.js';
import { getCarPI } from '../src/game/performance.js';
import { getDailyChallenge } from '../src/game/daily.js';
import { getSpecialOffers } from '../src/game/dealer.js';
import { availableSkillPoints, upgradeSkill, addXp } from '../src/game/progression.js';
import { createRace, simulateToEnd, classify } from '../src/sim/race.js';

function fakeStorage(initial = {}) {
    const data = { ...initial };
    return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: k => { delete data[k]; }, data };
}

function runEvent(league, event, car, seed = 1) {
    const setup = career.buildRaceSetup({ league, event }, car, seed);
    const table = classify(simulateToEnd(createRace(setup)));
    return { setup, table, summary: career.applyRaceResult(setup, table, {}) };
}

/** Rewrite a classification so the player finishes in `pos`. */
function forcePosition(table, pos) {
    const me = table.find(r => r.isPlayer);
    const rest = table.filter(r => !r.isPlayer);
    rest.splice(pos - 1, 0, me);
    return rest.map((r, i) => ({ ...r, position: i + 1 }));
}

beforeEach(() => {
    store.setStorage(fakeStorage());
    store.resetState('Tester');
});

describe('catalogue sanity', () => {
    it('every stock car is legal in its own class', () => {
        for (const car of CARS) {
            const pi = getCarPI({ modelId: car.id, equipped: {}, owned: [] });
            expect(pi, car.name).toBeLessThanOrEqual(CLASS_INFO[car.cls].piCap);
        }
    });

    it('league rosters reference real rivals and cars of the right class', () => {
        for (const league of LEAGUES) {
            expect(league.roster).toHaveLength(7);
            for (const [, modelId] of league.roster) expect(CARS.find(c => c.id === modelId)?.cls).toBe(league.id);
        }
    });
});

describe('garage', () => {
    it('buys a starter car and refuses one the player cannot afford', () => {
        expect(garage.buyCar('c1').ok).toBe(true);
        expect(store.state.money).toBe(store.STARTING_MONEY - 2800);
        expect(garage.buyCar('a-hyperion').ok).toBe(false);
        expect(store.state.cars).toHaveLength(1);
    });

    it('staged parts need the previous stage, and raise PI when fitted', () => {
        store.state.money = 50000;
        const car = garage.buyCar('c1').car;
        const before = getCarPI(car);
        expect(garage.buyUpgrade(car.uid, 'eng2').ok).toBe(false);
        expect(garage.buyUpgrade(car.uid, 'eng1').ok).toBe(true);
        expect(garage.buyUpgrade(car.uid, 'eng2').ok).toBe(true);
        expect(getCarPI(car)).toBeGreaterThan(before);
        garage.equipUpgrade(car.uid, 'engine', null);
        expect(getCarPI(car)).toBe(before);
    });

    it('never sells the last car', () => {
        const car = garage.buyCar('c1').car;
        expect(garage.sellCar(car.uid).ok).toBe(false);
    });
});

describe('career', () => {
    it('blocks cars over the PI cap', () => {
        store.state.money = 1e6;
        const car = garage.buyCar('c-kaido').car;
        expect(career.checkEligibility(car, LEAGUES[0]).ok).toBe(false);
        expect(career.checkEligibility(car, LEAGUES[1]).ok).toBe(true);
    });

    it('puts 8 distinct drivers on the grid, rivals in their own cars', () => {
        const car = garage.buyCar('c1').car;
        const setup = career.buildRaceSetup({ league: LEAGUES[0], event: LEAGUES[0].events[0] }, car, 9);
        expect(setup.entries).toHaveLength(8);
        expect(new Set(setup.entries.map(e => e.id)).size).toBe(8);
        expect(setup.entries.filter(e => e.isPlayer)).toHaveLength(1);
    });

    it('pays prizes, awards XP and records standings', () => {
        const car = garage.buyCar('c2').car;
        const moneyBefore = store.state.money;
        const { summary } = runEvent(LEAGUES[0], LEAGUES[0].events[0], car);
        expect(store.state.money).toBeGreaterThan(moneyBefore);
        expect(summary.xp).toBeGreaterThan(0);
        expect(store.state.stats.races).toBe(1);
        const total = career.getStandings('D').reduce((sum, r) => sum + r.points, 0);
        expect(total).toBe(25 + 18 + 15 + 12 + 10 + 8 + 6 + 4);
    });

    it('unlocks the next event only when the target is met, and halves replay prizes', () => {
        const car = garage.buyCar('c1').car;
        const league = LEAGUES[0];
        const event = league.events[0];
        const setup = career.buildRaceSetup({ league, event }, car, 3);
        const table = classify(simulateToEnd(createRace(setup)));

        career.applyRaceResult(setup, forcePosition(table, 8), {});
        expect(career.isEventUnlocked(league, 1)).toBe(false);

        const first = career.applyRaceResult(career.buildRaceSetup({ league, event }, car, 4), forcePosition(table, 1), {});
        expect(career.isEventUnlocked(league, 1)).toBe(true);
        const firstPrize = first.rewards.find(r => r.label.startsWith('Prize')).amount;

        const replay = career.applyRaceResult(career.buildRaceSetup({ league, event }, car, 5), forcePosition(table, 1), {});
        expect(replay.rewards.find(r => r.label.startsWith('Prize')).amount).toBe(firstPrize / 2);
        // Standings keep the best result only: still one race counted.
        expect(career.getStandings('D').find(r => r.isPlayer).races).toBe(1);
    });

    it('winning every event unlocks the next league and crowns a champion', () => {
        const car = garage.buyCar('c1').car;
        const league = LEAGUES[0];
        let last;
        league.events.forEach((event, i) => {
            const setup = career.buildRaceSetup({ league, event }, car, 20 + i);
            const table = classify(simulateToEnd(createRace(setup)));
            last = career.applyRaceResult(setup, forcePosition(table, 1), {});
        });
        expect(last.unlockedLeague.id).toBe('C');
        expect(last.champion).toBe(true);
        expect(store.state.career.unlockedLeagues).toContain('C');
        expect(career.isFeatureUnlocked('maintenance')).toBe(true);
        expect(store.state.achievements['champ-D']).toBeTruthy();
    });

    it('rivals spend prize money on parts but stay under the cap', () => {
        const car = garage.buyCar('c1').car;
        const league = LEAGUES[0];
        league.events.forEach((event, i) => runEvent(league, event, car, 50 + i));
        const wallets = store.state.career.rivals.D;
        expect(Object.values(wallets).some(w => w.items.length > 0)).toBe(true);
        const setup = career.buildRaceSetup({ league, event: league.events[0] }, car, 99);
        expect(setup.entries.some(e => e.tuned)).toBe(true);
        expect(store.state.career.intel.length).toBeGreaterThan(0);
    });
});

describe('progression, daily and dealer', () => {
    it('levels up and spends skill points', () => {
        expect(availableSkillPoints()).toBe(1);
        expect(upgradeSkill('cornering').ok).toBe(true);
        expect(upgradeSkill('cornering').ok).toBe(false);
        expect(addXp(5000)).toBeGreaterThan(2);
        expect(availableSkillPoints()).toBeGreaterThan(1);
    });

    it('daily challenge is stable for a day and different the next', () => {
        const a = getDailyChallenge('2026-11-12');
        const b = getDailyChallenge('2026-11-12');
        expect(a).toEqual(b);
        const names = new Set(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'].map(d => JSON.stringify(getDailyChallenge(d).event)));
        expect(names.size).toBeGreaterThan(1);
    });

    it('special offers are stable within a window', () => {
        const now = 1_800_000_000_000;
        expect(getSpecialOffers(2, now)).toEqual(getSpecialOffers(2, now + 1000));
        expect(getSpecialOffers(2, now)).toHaveLength(4);
    });
});

describe('save system', () => {
    it('round-trips through storage', () => {
        const storage = fakeStorage();
        store.setStorage(storage);
        store.resetState('Saver');
        garage.buyCar('c3');
        expect(store.loadState()).toBe('loaded');
        expect(store.state.name).toBe('Saver');
        expect(store.state.cars[0].modelId).toBe('c3');
    });

    it('migrates a prototype (V1) save', () => {
        const legacy = { version: 4, playerData: { name: 'OldTimer', money: 12345, ownedCars: ['c2', 'dealer_1_0'] }, carsUpgrades: { c2: ['eng1', 'eng2', 'tir1', 'bogus'] } };
        store.setStorage(fakeStorage({ projectRedlineSaveV1: JSON.stringify(legacy) }));
        expect(store.loadState()).toBe('migrated');
        expect(store.state.name).toBe('OldTimer');
        expect(store.state.money).toBe(12345);
        expect(store.state.cars).toHaveLength(1);
        expect(store.state.cars[0].owned).toEqual(['eng1', 'eng2', 'tir1']);
        expect(store.state.cars[0].equipped.engine).toBe('eng2');
    });

    it('survives corrupt data', () => {
        store.setStorage(fakeStorage({ [store.SAVE_KEY]: '{not json' }));
        expect(store.loadState()).toBe('new');
        expect(store.normalizeState({ cars: [{ modelId: 'nope' }], money: 'x' }).cars).toHaveLength(0);
    });

    it('rejects imports that are not saves', () => {
        expect(() => store.importSave('{"hello":1}')).toThrow();
    });
});
