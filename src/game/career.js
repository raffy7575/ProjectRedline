// Career rules: what is unlocked, who is on the grid, and what a result is worth.

import { state, commit } from '../core/store.js';
import { createRng, randRange } from '../core/rng.js';
import { CARS } from '../data/cars.js';
import { LEAGUES, POINTS_TABLE, PRIZE_SPLIT, REPLAY_PRIZE_FACTOR, findEvent, getLeague } from '../data/leagues.js';
import { getRival } from '../data/rivals.js';
import { getTrackDef } from '../data/tracks.js';
import { buildTrack } from '../sim/track.js';
import { derivePerf, applyEffects } from '../sim/vehicle.js';
import { computeProfile } from '../sim/profile.js';
import { getCarPI, getCarPerf, getCarSpec } from './performance.js';
import { carDisplayColor, applyRaceWear, fullServiceCost } from './garage.js';
import { rivalTunedSpec, ensureLeagueRivals, payAndShopRivals } from './rivals.js';
import { addXp, playerDriverProfile, playerPerfSkills, unlockAchievement, checkStatAchievements } from './progression.js';
import { todayKey } from './daily.js';

const DIFFICULTY_OFFSET = { easy: -0.012, normal: 0, hard: 0.009 };
const POSITION_XP = [120, 85, 65, 45, 30, 20, 12, 6];

// ── Unlocks ──────────────────────────────────────────────────────────────────

export function highestUnlockedTier() {
    return LEAGUES.filter(l => state.career.unlockedLeagues.includes(l.id)).reduce((max, l) => Math.max(max, l.tier), 1);
}

export function highestUnlockedLeague() {
    return LEAGUES.filter(l => state.career.unlockedLeagues.includes(l.id)).sort((a, b) => b.tier - a.tier)[0] || LEAGUES[0];
}

const FEATURE_TIER = { maintenance: 2, rivalIntel: 2, specialOffers: 2 };

export function isFeatureUnlocked(feature) {
    return highestUnlockedTier() >= (FEATURE_TIER[feature] || 1);
}

export function isLeagueUnlocked(leagueId) {
    return state.career.unlockedLeagues.includes(leagueId);
}

export function eventBestPosition(eventId) {
    return state.career.results[eventId]?.bestPos ?? null;
}

export function isEventCompleted(event) {
    const best = eventBestPosition(event.id);
    return best !== null && best <= event.target;
}

export function isEventUnlocked(league, index) {
    if (!isLeagueUnlocked(league.id)) return false;
    return league.events.slice(0, index).every(isEventCompleted);
}

export function isLeagueCompleted(league) {
    return league.events.every(isEventCompleted);
}

/** The event the player should do next (first incomplete unlocked event). */
export function nextEvent() {
    for (const league of LEAGUES) {
        if (!isLeagueUnlocked(league.id)) continue;
        const index = league.events.findIndex(e => !isEventCompleted(e));
        if (index >= 0) return { league, event: league.events[index], index };
    }
    return null;
}

export function trackKey(trackId, reverse) {
    return reverse ? `${trackId}:r` : trackId;
}

// ── Standings ────────────────────────────────────────────────────────────────

export function getStandings(leagueId) {
    const league = getLeague(leagueId);
    const table = new Map();
    const row = (driverId) => {
        if (!table.has(driverId)) {
            const rival = getRival(driverId);
            table.set(driverId, {
                driverId,
                name: driverId === 'player' ? state.name : (rival?.name || driverId),
                color: rival?.color || '#ffffff',
                isPlayer: driverId === 'player',
                points: 0, wins: 0, podiums: 0, races: 0
            });
        }
        return table.get(driverId);
    };
    row('player');
    league.roster.forEach(([rivalId]) => row(rivalId));
    league.events.forEach(event => {
        const result = state.career.results[event.id];
        if (!result) return;
        result.order.forEach((driverId, i) => {
            const r = row(driverId);
            r.points += POINTS_TABLE[i] || 0;
            r.races++;
            if (i === 0) r.wins++;
            if (i < 3) r.podiums++;
        });
    });
    return [...table.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || (a.isPlayer ? -1 : 1));
}

// ── Eligibility ("tech inspection") ──────────────────────────────────────────

export function checkEligibility(car, league) {
    if (!car) return { ok: false, checks: [{ label: 'No car selected', pass: false }] };
    const pi = getCarPI(car);
    const checks = [{ label: `PI ${pi} / max ${league.piCap}`, pass: pi <= league.piCap }];
    return { ok: checks.every(c => c.pass), checks, pi };
}

// ── Building a race ──────────────────────────────────────────────────────────

/**
 * @param {object} ctx  { league, event, daily?: boolean, loanerModelId?: string }
 * @param {object} car  the player's car (ignored for loaner events)
 * @returns race setup consumed by sim/race.js plus career metadata
 */
export function buildRaceSetup(ctx, car, seed = (Date.now() & 0x7fffffff)) {
    const { league, event } = ctx;
    const track = buildTrack(getTrackDef(event.trackId), { reverse: !!event.reverse });
    const rng = createRng(seed);
    const loaner = ctx.loanerModelId ? CARS.find(c => c.id === ctx.loanerModelId) : null;
    ensureLeagueRivals(league);

    const playerSpec = loaner || getCarSpec(car);
    const playerPerf = loaner
        ? derivePerf(applyEffects(loaner, []), { skills: playerPerfSkills() })
        : getCarPerf(car, playerPerfSkills(), isFeatureUnlocked('maintenance'));
    const entries = [{
        id: 'player',
        name: state.name,
        carName: playerSpec.name,
        color: loaner ? loaner.color : carDisplayColor(car),
        body: playerSpec.body,
        isPlayer: true,
        perf: playerPerf,
        driver: playerDriverProfile()
    }];

    const offset = DIFFICULTY_OFFSET[state.settings.difficulty] ?? 0;
    league.roster.forEach(([rivalId, modelId]) => {
        const rival = getRival(rivalId);
        const model = loaner || CARS.find(c => c.id === modelId);
        const spec = loaner ? applyEffects(loaner, []) : rivalTunedSpec(league, rivalId, track.dirtShare);
        entries.push({
            id: rivalId,
            name: rival.name,
            carName: model.name,
            color: rival.color,
            body: model.body,
            isPlayer: false,
            tuned: !loaner && (state.career.rivals[league.id]?.[rivalId]?.items.length || 0) > 0,
            perf: derivePerf(spec),
            driver: {
                skill: league.rivalSkill + rival.talent + offset + randRange(rng, -0.003, 0.003),
                aggression: rival.aggression,
                consistency: rival.consistency,
                tyreCare: 1.05 - rival.consistency * 0.15,
                launch: 0.3 + rival.aggression * 0.5
            }
        });
    });

    // Qualifying: one simulated flying lap each, with a little luck.
    const qualified = entries.map(entry => {
        const ideal = computeProfile(track, entry.perf).lapTime;
        return { entry, time: (ideal / entry.driver.skill) * (1 + randRange(rng, 0, 0.012)) };
    }).sort((a, b) => a.time - b.time);
    qualified.forEach((q, i) => { q.entry.qualiTime = q.time; q.entry.gridSlot = i + 1; });

    // Bounty: the best-placed rival in the standings (or the pole-sitter early on).
    const standings = getStandings(league.id).filter(r => !r.isPlayer);
    const hasPoints = standings.some(r => r.points > 0);
    const bountyId = hasPoints ? standings[0].driverId : (qualified.find(q => !q.entry.isPlayer)?.entry.id || null);

    return {
        track,
        laps: event.laps,
        entries: qualified.map(q => q.entry),
        seed: (seed ^ 0x9e3779b9) >>> 0,
        league,
        event,
        daily: !!ctx.daily,
        loaner: !!loaner,
        carUid: loaner ? null : car.uid,
        bounty: bountyId ? { rivalId: bountyId, name: getRival(bountyId).name, amount: Math.round(event.prize * 0.25 / 50) * 50 } : null,
        wasCompleted: ctx.daily ? state.daily.doneDay === todayKey() : isEventCompleted(event)
    };
}

// ── Applying a result ────────────────────────────────────────────────────────

/**
 * @param {object} setup           from buildRaceSetup()
 * @param {Array}  classification  from sim classify()
 * @param {object} info            { launchRating, pushShare, fastestLapId }
 */
export function applyRaceResult(setup, classification, info = {}) {
    const { league, event } = setup;
    const me = classification.find(r => r.isPlayer);
    const position = me.position;
    const car = state.cars.find(c => c.uid === setup.carUid) || null;
    const summary = {
        position, gridSlot: me.gridSlot, eventName: event.name, leagueName: league.name, daily: setup.daily,
        rewards: [], xp: 0, levelsGained: 0, achievements: [], unlockedLeague: null, eventCompleted: false,
        targetMet: position <= event.target, target: event.target, newRecord: null, wear: null, intel: [], champion: false
    };
    const pay = (label, amount) => {
        if (amount <= 0) return;
        state.money += amount;
        state.stats.earnings += amount;
        summary.rewards.push({ label, amount });
    };

    // Prize money
    const replay = setup.wasCompleted;
    const prize = Math.round((event.prize * (PRIZE_SPLIT[position - 1] || 0.05) * (replay ? REPLAY_PRIZE_FACTOR : 1)) / 10) * 10;
    if (!(setup.daily && replay)) pay(replay ? `Prize (replay, P${position})` : `Prize (P${position})`, prize);

    if (setup.bounty) {
        const rival = classification.find(r => r.id === setup.bounty.rivalId);
        if (rival && position < rival.position && !(setup.daily && replay)) pay(`Bounty: beat ${setup.bounty.name}`, replay ? Math.round(setup.bounty.amount / 2) : setup.bounty.amount);
    }

    // Lap record (flying laps only)
    const flying = me.lapTimes.slice(1);
    const bestFlying = flying.length ? Math.min(...flying) : 0;
    const key = trackKey(event.trackId, event.reverse);
    if (bestFlying > 0 && !setup.loaner && (!state.records[key] || bestFlying < state.records[key].lap)) {
        const previous = state.records[key]?.lap || null;
        state.records[key] = { lap: bestFlying, carName: me.carName, at: Date.now() };
        summary.newRecord = { lap: bestFlying, previous };
        pay('New personal lap record', 150 * league.tier);
    }

    // Career bookkeeping
    if (setup.daily) {
        if (summary.targetMet && state.daily.doneDay !== todayKey()) {
            const yesterday = todayKey(new Date(Date.now() - 86400000));
            state.daily.streak = state.daily.lastDay === yesterday ? state.daily.streak + 1 : 1;
            state.daily.doneDay = todayKey();
            state.daily.lastDay = todayKey();
            summary.eventCompleted = true;
            const streakBonus = Math.min(5, state.daily.streak - 1) * Math.round(event.prize * 0.1 / 50) * 50;
            if (streakBonus > 0) pay(`Daily streak x${state.daily.streak}`, streakBonus);
        }
    } else {
        const previous = state.career.results[event.id];
        const firstAttempt = !previous;
        const improved = !previous || position < previous.bestPos;
        const wasLeagueDone = isLeagueCompleted(league);
        state.career.results[event.id] = {
            order: improved ? classification.map(r => r.id) : previous.order,
            bestPos: improved ? position : previous.bestPos,
            lastPos: position,
            attempts: (previous?.attempts || 0) + 1
        };
        summary.eventCompleted = !replay && summary.targetMet;

        if (firstAttempt) summary.intel = payAndShopRivals(league, event, classification);

        if (!wasLeagueDone && isLeagueCompleted(league)) {
            const next = LEAGUES.find(l => l.tier === league.tier + 1);
            if (next && !state.career.unlockedLeagues.includes(next.id)) {
                state.career.unlockedLeagues.push(next.id);
                summary.unlockedLeague = next;
            }
        }
        const allRaced = league.events.every(e => state.career.results[e.id]);
        if (allRaced && !state.career.champions[league.id] && getStandings(league.id)[0].isPlayer) {
            state.career.champions[league.id] = true;
            summary.champion = true;
            pay(`${league.name} champion!`, league.championBonus);
            const a = unlockAchievement(`champ-${league.id}`);
            if (a) summary.achievements.push(a);
        }
    }

    // Stats
    const stats = state.stats;
    stats.races++;
    stats.distanceKm += (setup.track.length * setup.laps) / 1000;
    stats.overtakes += me.overtakes;
    if (position === 1) { stats.wins++; stats.winStreak++; stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.winStreak); }
    else stats.winStreak = 0;
    if (position <= 3) stats.podiums++;
    if (info.launchRating === 'perfect') stats.perfectLaunches++;
    if (car) { car.races++; if (position === 1) car.wins++; }

    // Race-specific achievements
    const second = classification[1];
    const unlock = (id, condition) => {
        if (!condition) return;
        const a = unlockAchievement(id);
        if (a) summary.achievements.push(a);
    };
    unlock('last-to-first', position === 1 && me.gridSlot >= 6);
    unlock('photo-finish', position === 1 && second && second.gap < 0.3);
    unlock('dominant', position === 1 && second && second.gap > 6);
    unlock('clean-race', position === 1 && me.mistakes === 0 && (info.pushShare || 0) > 0.5);

    // XP
    const xp = Math.round((50 + (POSITION_XP[position - 1] || 0) + (info.fastestLapId === 'player' ? 20 : 0)) * league.xpMul * (replay ? 0.6 : 1));
    summary.xp = xp;
    summary.levelsGained = addXp(xp);

    // Wear and tear (own cars only, once maintenance exists)
    if (car && isFeatureUnlocked('maintenance')) {
        const wear = applyRaceWear(car, {
            tyreWear: me.tyreWear,
            dirtShare: setup.track.dirtShare,
            raceKm: (setup.track.length * setup.laps) / 1000
        });
        summary.wear = { ...wear, serviceCost: fullServiceCost(car) };
    }

    summary.achievements.push(...checkStatAchievements());
    summary.totalMoney = summary.rewards.reduce((sum, r) => sum + r.amount, 0)
        + summary.achievements.reduce((sum, a) => sum + a.reward, 0);
    commit('race-result');
    return summary;
}

/** Driver-standings position of the player in a league (1-based). */
export function playerStandingPosition(leagueId) {
    return getStandings(leagueId).findIndex(r => r.isPlayer) + 1;
}

export { findEvent };
