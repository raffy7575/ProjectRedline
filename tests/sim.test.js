import { describe, it, expect } from 'vitest';
import { TRACKS } from '../src/data/tracks.js';
import { CARS } from '../src/data/cars.js';
import { buildTrack } from '../src/sim/track.js';
import { derivePerf, applyEffects, headlineStats } from '../src/sim/vehicle.js';
import { computeProfile } from '../src/sim/profile.js';
import { createRace, stepRace, simulateToEnd, classify, tyreGripFactor, pressLaunch } from '../src/sim/race.js';

const driver = { skill: 0.96, aggression: 0.5, consistency: 0.8, tyreCare: 1, launch: 0.5 };
const entriesFor = (cars) => cars.map((c, i) => ({
    id: `e${i}`, name: `Driver ${i}`, carName: c.name, color: c.color, isPlayer: i === 0,
    perf: derivePerf(applyEffects(c, [])), driver
}));

describe('track builder', () => {
    it.each(TRACKS.map(t => [t.name, t]))('%s is a closed loop of the declared length', (_name, def) => {
        const track = buildTrack(def);
        let length = 0;
        for (let i = 0; i < track.n; i++) {
            const j = (i + 1) % track.n;
            length += Math.hypot(track.x[j] - track.x[i], track.y[j] - track.y[i]);
        }
        expect(length).toBeGreaterThan(def.lengthM * 0.97);
        expect(length).toBeLessThan(def.lengthM * 1.03);
        expect(track.corners.length).toBeGreaterThan(3);
        expect(Math.max(...track.curvature.map(Math.abs))).toBeLessThanOrEqual(1 / 11 + 1e-9);
    });

    it('reverse keeps length and start point', () => {
        const a = buildTrack(TRACKS[0]);
        const b = buildTrack(TRACKS[0], { reverse: true });
        expect(b.length).toBe(a.length);
        expect(b.x[0]).toBeCloseTo(a.x[0], 3);
    });
});

describe('vehicle model', () => {
    it('gives every car believable headline numbers', () => {
        for (const car of CARS) {
            const h = headlineStats(derivePerf(applyEffects(car, [])));
            expect(h.zeroToHundred, car.name).toBeGreaterThan(1.8);
            expect(h.zeroToHundred, car.name).toBeLessThan(12);
            expect(h.topSpeedKmh, car.name).toBeGreaterThan(160);
            expect(h.topSpeedKmh, car.name).toBeLessThan(430);
        }
    });

    it('more power and less weight make a car faster', () => {
        const track = buildTrack(TRACKS[0]);
        const base = computeProfile(track, derivePerf(applyEffects(CARS[0], []))).lapTime;
        const tuned = computeProfile(track, derivePerf(applyEffects(CARS[0], [{ powerPct: 20 }, { weight: -100 }]))).lapTime;
        expect(tuned).toBeLessThan(base - 0.5);
    });

    it('rally tyres win on dirt and lose on tarmac', () => {
        const dirt = buildTrack(TRACKS.find(t => t.id === 't4'));
        const tarmac = buildTrack(TRACKS.find(t => t.id === 't1'));
        const street = derivePerf(applyEffects(CARS[0], []));
        const gravel = derivePerf(applyEffects(CARS[0], [{ grip: -0.05, dirtGrip: 0.24 }]));
        expect(computeProfile(dirt, gravel).lapTime).toBeLessThan(computeProfile(dirt, street).lapTime);
        expect(computeProfile(tarmac, gravel).lapTime).toBeGreaterThan(computeProfile(tarmac, street).lapTime);
    });
});

describe('race simulation', () => {
    const track = buildTrack(TRACKS[0]);
    const grid = () => entriesFor(CARS.filter(c => c.cls === 'D').flatMap(c => [c, c]));

    it('finishes with a full, ordered classification', () => {
        const race = simulateToEnd(createRace({ track, laps: 3, entries: grid(), seed: 42 }));
        const table = classify(race);
        expect(race.phase).toBe('finished');
        expect(table).toHaveLength(8);
        expect(table[0].lapTimes).toHaveLength(3);
        for (let i = 1; i < table.length; i++) expect(table[i].totalTime).toBeGreaterThanOrEqual(table[i - 1].totalTime);
        // Cars are different, so the field must not finish in a dead heat.
        expect(table[7].totalTime - table[0].totalTime).toBeGreaterThan(1);
        expect(table[0].totalTime).toBeGreaterThan(100);
        expect(table[0].totalTime).toBeLessThan(260);
    });

    it('is deterministic for a given seed', () => {
        const a = classify(simulateToEnd(createRace({ track, laps: 2, entries: grid(), seed: 7 })));
        const b = classify(simulateToEnd(createRace({ track, laps: 2, entries: grid(), seed: 7 })));
        expect(a.map(r => [r.id, r.totalTime])).toEqual(b.map(r => [r.id, r.totalTime]));
    });

    it('cars actually accelerate, brake and vary speed', () => {
        const race = createRace({ track, laps: 1, entries: grid(), seed: 3 });
        let min = Infinity;
        let max = 0;
        while (race.phase !== 'finished' && race.clock < 80) {
            stepRace(race);
            if (race.time > 12) { min = Math.min(min, race.cars[0].v); max = Math.max(max, race.cars[0].v); }
        }
        expect(max * 3.6).toBeGreaterThan(110);
        expect(min * 3.6).toBeLessThan(90);
    });

    it('push mode wears tyres faster than save mode', () => {
        const wearWith = (pace) => {
            const race = createRace({ track, laps: 3, entries: grid(), seed: 11 });
            race.input.pace = pace;
            simulateToEnd(race);
            return race.player.tyreWear;
        };
        expect(wearWith('push')).toBeGreaterThan(wearWith('save') * 1.5);
    });

    it('tyre grip fades then falls off a cliff', () => {
        expect(tyreGripFactor(0)).toBe(1);
        expect(tyreGripFactor(0.5)).toBeGreaterThan(0.94);
        expect(tyreGripFactor(1)).toBeLessThan(0.85);
    });

    it('rewards a perfect launch and punishes a jump start', () => {
        const perfect = createRace({ track, laps: 1, entries: grid(), seed: 5 });
        while (perfect.clock < 0.1) stepRace(perfect);
        pressLaunch(perfect);
        expect(perfect.launch.rating).toBe('perfect');

        const jump = createRace({ track, laps: 1, entries: grid(), seed: 5 });
        while (jump.clock < -0.4) stepRace(jump);
        pressLaunch(jump);
        expect(jump.launch.rating).toBe('jump');
        expect(jump.player.reaction).toBe(1.0);
    });
});
