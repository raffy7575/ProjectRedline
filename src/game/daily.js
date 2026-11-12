// Daily Challenge: one seeded event per calendar day, the same for everyone.
// Half the days hand every driver the same stock loaner car (pure driving),
// the other half are "bring your own car" under the league cap.

import { state } from '../core/store.js';
import { createRng, pick } from '../core/rng.js';
import { CARS } from '../data/cars.js';
import { LEAGUES } from '../data/leagues.js';
import { TRACKS } from '../data/tracks.js';

export function todayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const DAILY_NAMES = ['Midnight Dash', 'Rush Hour', 'Backstreet Brawl', 'Underground Cup', 'Tunnel Run', 'Harbour Heat', 'Last Call', 'Blacktop Blitz'];

export function getDailyChallenge(dayKey = todayKey()) {
    const rng = createRng(`daily:${dayKey}`);
    const league = LEAGUES.filter(l => state.career.unlockedLeagues.includes(l.id)).sort((a, b) => b.tier - a.tier)[0] || LEAGUES[0];
    const trackDef = pick(rng, TRACKS);
    const reverse = rng() > 0.5;
    const laps = trackDef.lengthM > 2600 ? 2 : 3;
    const isLoaner = rng() > 0.5;
    const loaner = isLoaner ? pick(rng, CARS.filter(c => c.cls === league.id)) : null;
    const midPrize = league.events[1].prize;
    return {
        dayKey,
        league,
        loanerModelId: loaner ? loaner.id : null,
        loanerName: loaner ? loaner.name : null,
        event: {
            id: `daily-${dayKey}`,
            name: pick(rng, DAILY_NAMES),
            trackId: trackDef.id,
            reverse,
            laps,
            prize: Math.round(midPrize * 1.3 / 50) * 50,
            target: 3
        }
    };
}

export function isDailyDone() {
    return state.daily.doneDay === todayKey();
}

/** Streak that is still alive (done today or yesterday). */
export function currentDailyStreak() {
    const yesterday = todayKey(new Date(Date.now() - 86400000));
    return (state.daily.lastDay === todayKey() || state.daily.lastDay === yesterday) ? state.daily.streak : 0;
}
