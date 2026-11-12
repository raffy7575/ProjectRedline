// Career ladder. Each league is a 4-race championship with a Performance Index
// cap (see game/performance.js). Meet an event's target position to unlock the
// next one; finish every event to unlock the next league.

export const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4];
export const PRIZE_SPLIT = [1, 0.62, 0.42, 0.3, 0.22, 0.16, 0.12, 0.08];
export const REPLAY_PRIZE_FACTOR = 0.5;

export const LEAGUES = [
    {
        id: 'D', name: 'Amateur League', tier: 1, piCap: 310, rivalSkill: 0.948, championBonus: 4000, xpMul: 1,
        description: 'Entry-level street series. Cheap cars, close racing, big egos.',
        roster: [
            ['rival-ember', 'd4'], ['rival-apex', 'c2'], ['rival-shale', 'c3'], ['rival-juno', 'c1'],
            ['rival-rook', 'd4'], ['rival-mika', 'c2'], ['rival-dax', 'c1']
        ],
        events: [
            { id: 'ev-d1', name: 'Dockside Opener', trackId: 't-dock', laps: 3, prize: 1200, target: 4 },
            { id: 'ev-d2', name: 'City Control Sprint', trackId: 't2', laps: 3, prize: 1500, target: 3 },
            { id: 'ev-d3', name: 'Dustline Challenge', trackId: 't3', laps: 3, prize: 1800, target: 3 },
            { id: 'ev-d4', name: 'Amateur Final', trackId: 't-dock', reverse: true, laps: 4, prize: 2600, target: 3 }
        ]
    },
    {
        id: 'C', name: 'Semi-Pro League', tier: 2, piCap: 410, rivalSkill: 0.952, championBonus: 12000, xpMul: 1.5,
        description: 'Faster circuits, sharper drivers and rivals who spend their winnings on parts.',
        roster: [
            ['rival-ember', 'c-brawler'], ['rival-apex', 'c-kaido'], ['rival-shale', 'c-ridge'], ['rival-juno', 'c-hornet'],
            ['rival-vex', 'c-kaido'], ['rival-mika', 'c-hornet'], ['rival-tor', 'c-ridge']
        ],
        events: [
            { id: 'ev-c1', name: 'Hammerhead Sprint Cup', trackId: 't1', laps: 3, prize: 3400, target: 4 },
            { id: 'ev-c2', name: 'Canyon Technical Trial', trackId: 't4', laps: 4, prize: 3800, target: 3 },
            { id: 'ev-c3', name: 'Serpent Reverse', trackId: 't2', reverse: true, laps: 4, prize: 4200, target: 3 },
            { id: 'ev-c4', name: 'Neon Nights', trackId: 't-neon', laps: 4, prize: 5600, target: 3 }
        ]
    },
    {
        id: 'B', name: 'Pro League', tier: 3, piCap: 520, rivalSkill: 0.956, championBonus: 32000, xpMul: 2.2,
        description: 'Serious machinery. Tyre management and clean laps decide championships here.',
        roster: [
            ['rival-ember', 'b-colossus'], ['rival-apex', 'b-venom'], ['rival-shale', 'b-tundra'], ['rival-vex', 'b-specter'],
            ['rival-sable', 'b-venom'], ['rival-tor', 'b-tundra'], ['rival-kira', 'b-specter']
        ],
        events: [
            { id: 'ev-b1', name: 'Coastline 100', trackId: 't-coast', laps: 3, prize: 9500, target: 4 },
            { id: 'ev-b2', name: 'Alpine Rally-Cross', trackId: 't-alpine', laps: 3, prize: 11000, target: 3 },
            { id: 'ev-b3', name: 'Hammerhead Reverse', trackId: 't1', reverse: true, laps: 4, prize: 12000, target: 3 },
            { id: 'ev-b4', name: 'Neon Grand Prix', trackId: 't-neon', reverse: true, laps: 5, prize: 15000, target: 2 }
        ]
    },
    {
        id: 'A', name: 'Elite League', tier: 4, piCap: 700, rivalSkill: 0.960, championBonus: 100000, xpMul: 3.2,
        description: 'The top of the street. Hypercars, the Redline Ring and no second chances.',
        roster: [
            ['rival-ember', 'a-hyperion'], ['rival-apex', 'a-phantom'], ['rival-vex', 'a-zenith'], ['rival-sable', 'a-phantom'],
            ['rival-kira', 'a-zenith'], ['rival-tor', 'a-zenith'], ['rival-nyx', 'a-hyperion']
        ],
        events: [
            { id: 'ev-a1', name: 'Ring Opener', trackId: 't-ring', laps: 3, prize: 28000, target: 3 },
            { id: 'ev-a2', name: 'Coastline GP', trackId: 't-coast', reverse: true, laps: 4, prize: 32000, target: 3 },
            { id: 'ev-a3', name: 'Alpine Summit', trackId: 't-alpine', reverse: true, laps: 3, prize: 36000, target: 2 },
            { id: 'ev-a4', name: 'Redline Grand Final', trackId: 't-ring', laps: 4, prize: 65000, target: 1 }
        ]
    }
];

export function getLeague(leagueId) {
    return LEAGUES.find(l => l.id === leagueId) || null;
}

export function findEvent(eventId) {
    for (const league of LEAGUES) {
        const index = league.events.findIndex(e => e.id === eventId);
        if (index >= 0) return { league, event: league.events[index], index };
    }
    return null;
}
