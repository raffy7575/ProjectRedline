/* =============================================================================
    data.js  —  Core game content database (player defaults, cars, shop, tracks)

    WHAT THIS FILE DOES
    - Defines initial player profile template (`playerData`)
    - Declares starter cars and physics/stats metadata (`cars`)
    - Defines upgrade catalog (`shopItems`)
    - Defines tracks and waypoints (`tracks`)
    - Declares AI rivals and career leagues/events

    SAFE THINGS TO EDIT
    - Car prices/colors/base stats in `cars`
    - Upgrade costs/boosts in `shopItems`
    - Track lap counts and waypoint layouts in `tracks`
    - League rewards/restrictions in `leagues`

    CAUTION
    - IDs are references across many files and saves. Keep IDs stable once used.
    - Large stat jumps can break race balance; tune in small steps.
    ============================================================================= */

// ── Player default profile ───────────────────────────────────────────────────
let playerData = { 
    name: 'Driver',
    money: 10000, 
    ownedCars: [], 
    carCondition: {},
    dealerCars: [],
    careerProgress: {
        unlockedLeagueIds: ['league-amateur'],
        completedEventIds: [],
        bestPositions: {},
        eventStatus: {},
        leagueStandings: {},
        aiState: {
            rivals: {},
            eventUpgradeFeed: {},
            lastProcessedEventId: null
        }
    },
    skills: {
        shifting: { level: 0, max: 10, baseCost: 1000, name: "Power Shifting", desc: "Improves gear shifts.", effect: "+2% Acceleration per level" },
        cornering: { level: 0, max: 10, baseCost: 1200, name: "Apex Precision", desc: "Better racing lines.", effect: "+2% Handling per level" },
        braking: { level: 0, max: 10, baseCost: 800, name: "Trail Braking", desc: "Late braking technique.", effect: "+2% Braking per level" }
    }
};

// ── Starter + persistent car catalog ─────────────────────────────────────────
const cars = [
    { 
        id: 'c1', 
        name: "Apex Bullet", 
        price: 1200, 
        color: "#F44336", 
        upgrades: [], 
        baseStats: { topSpeed: 62, acceleration: 58, braking: 50, handling: 45, dirt: 20, tarmac: 65 },
        hp: 72,
        // torque = hp * 745.7 / (0.6 * redline * 2π/60) = 72 * 745.7 / (3120 * 0.1047) ≈ 164 Nm
        torque: 164,
        weight: 1420,
        dragCoeff: 0.52,
        downforceCoeff: 0.25,  // Small front splitter / mild aero
        gForceMax: 0.7,
        redline: 5200,
        gearRatios: [3.5, 2.1, 1.5, 1.1, 0.85, 0.7],
        wheelRadius: 0.32
    },
    { 
        id: 'c2', 
        name: "Grip Master", 
        price: 1500, 
        color: "#2196F3", 
        upgrades: [], 
        baseStats: { topSpeed: 52, acceleration: 54, braking: 65, handling: 70, dirt: 28, tarmac: 62 },
        hp: 65,
        // torque = 65 * 745.7 / (0.6 * 5000 * 0.1047) ≈ 154 Nm
        torque: 154,
        weight: 1560,
        dragCoeff: 0.54,
        downforceCoeff: 0.55,  // Full aero kit — splitter, diffuser, wing
        gForceMax: 0.8,
        redline: 5000,
        gearRatios: [3.8, 2.3, 1.6, 1.2, 0.95, 0.8],
        wheelRadius: 0.32
    },
    { 
        id: 'c3', 
        name: "Dusty Ranger", 
        price: 1000, 
        color: "#FF9800", 
        upgrades: [], 
        baseStats: { topSpeed: 55, acceleration: 50, braking: 45, handling: 50, dirt: 72, tarmac: 30 },
        hp: 68,
        // torque = 68 * 745.7 / (0.6 * 4800 * 0.1047) ≈ 168 Nm
        torque: 168,
        weight: 1480,
        dragCoeff: 0.58,
        downforceCoeff: 0.15,  // Rally-spec: minimal aero, priority is ground clearance
        gForceMax: 0.65,
        redline: 4800,
        gearRatios: [3.2, 1.9, 1.4, 1.0, 0.75],
        wheelRadius: 0.32
    }
];

// ── Upgrade catalog (grouped by shop category) ──────────────────────────────
const shopItems = {
    engine: [
        { id: 'eng1', name: 'Sport Air Filter', cost: 300, boosts: { acceleration: 5 } },
        { id: 'eng2', name: 'ECU Remap', cost: 1200, boosts: { topSpeed: 8, acceleration: 5 } },
        { id: 'eng3', name: 'Forged Internals', cost: 3500, boosts: { topSpeed: 15, acceleration: 10 } }
    ],
    turbo: [
        { id: 'tur1', name: 'Stage 1 Turbo', cost: 2000, boosts: { topSpeed: 5, acceleration: 12 } },
        { id: 'tur2', name: 'Twin Turbo Kit', cost: 5000, boosts: { topSpeed: 10, acceleration: 25 } }
    ],
    exhaust: [
        { id: 'exh1', name: 'Straight Pipe', cost: 500, boosts: { topSpeed: 3, acceleration: 2 } },
        { id: 'exh2', name: 'Titanium Exhaust', cost: 1800, boosts: { topSpeed: 8, acceleration: 4, handling: 2 } }
    ],
    weight: [
        { id: 'wgt1', name: 'Stripped Interior', cost: 800, boosts: { acceleration: 5, handling: 5, braking: 5 }, weightReduction: -40 },
        { id: 'wgt2', name: 'Carbon Fiber Panels', cost: 4000, boosts: { acceleration: 12, handling: 10, braking: 10 }, weightReduction: -80 }
    ],
    suspension: [
        { id: 'sus1', name: 'Lowering Springs', cost: 400, boosts: { handling: 6, tarmac: 5 } },
        { id: 'sus2', name: 'Track Coilovers', cost: 2500, boosts: { handling: 18, tarmac: 15, dirt: -5 } }
    ],
    braking: [
        { id: 'brk1', name: 'Slotted Rotors', cost: 600, boosts: { braking: 10 } },
        { id: 'brk2', name: 'Carbon Ceramic Kit', cost: 3000, boosts: { braking: 25, handling: 5 } }
    ],
    tires: [
        { id: 'tir1', name: 'Semi-Slicks', cost: 1000, boosts: { handling: 10, braking: 5, tarmac: 20, dirt: -15 } },
        { id: 'tir2', name: 'Rally Gravel Tires', cost: 1000, boosts: { handling: 5, braking: 5, dirt: 30, tarmac: -10 } }
    ]
};

// ── Track definitions + waypoint layouts ─────────────────────────────────────
const tracks = [
    { id: 't1', name: "Hammerhead", laps: 7, tarmac: 1.0, dirt: 0.0, waypoints: [ {x:0.1, y:0.2}, {x:0.8, y:0.2}, {x:0.9, y:0.4}, {x:0.7, y:0.6}, {x:0.9, y:0.8}, {x:0.5, y:0.9}, {x:0.4, y:0.6}, {x:0.2, y:0.7}, {x:0.1, y:0.5} ] },
    { id: 't2', name: "The Serpent", laps: 5, tarmac: 0.9, dirt: 0.1, waypoints: [ {x:0.2, y:0.1}, {x:0.8, y:0.1}, {x:0.8, y:0.3}, {x:0.2, y:0.4}, {x:0.2, y:0.6}, {x:0.8, y:0.7}, {x:0.8, y:0.9}, {x:0.1, y:0.9}, {x:0.05, y:0.5} ] },
    { id: 't3', name: "Dragon's Tail", laps: 4, tarmac: 0.5, dirt: 0.5, waypoints: [ {x:0.1, y:0.5}, {x:0.9, y:0.1}, {x:0.9, y:0.9}, {x:0.7, y:0.8}, {x:0.6, y:0.9}, {x:0.4, y:0.7}, {x:0.2, y:0.9} ] },
    { id: 't4', name: "Muddy Canyon", laps: 4, tarmac: 0.2, dirt: 0.8, waypoints: [ {x:0.1, y:0.8}, {x:0.2, y:0.2}, {x:0.8, y:0.2}, {x:0.9, y:0.8}, {x:0.5, y:0.5} ] } 
];

// ── Named AI rivals (mapped to car IDs) ──────────────────────────────────────
const aiRivals = [
    {
        id: 'rival-ember',
        name: 'Ember Vale',
        carId: 'c1',
        buildBias: 'power',
        riskTolerance: 0.72
    },
    {
        id: 'rival-apex',
        name: 'Apex Mori',
        carId: 'c2',
        buildBias: 'grip',
        riskTolerance: 0.58
    },
    {
        id: 'rival-shale',
        name: 'Shale Knox',
        carId: 'c3',
        buildBias: 'offroad',
        riskTolerance: 0.64
    }
];

// ── Career league ladder and event policies ──────────────────────────────────
const leagues = [
    {
        id: 'league-amateur',
        name: 'Amateur League',
        class: 'Class D',
        tier: 1,
        description: 'Entry-level championship focused on balanced builds and clean setup choices.',
        pointsTable: [15, 12, 10, 8, 6, 4, 2, 1],
        events: [
            {
                id: 'event-amateur-sprint-01',
                name: 'City Control Sprint',
                trackId: 't2',
                prize: 1800,
                requiredPosition: 3,
                restrictions: {
                    maxHp: 120,
                    maxWeight: 1600
                }
            },
            {
                id: 'event-amateur-mix-02',
                name: 'Dustline Challenge',
                trackId: 't3',
                prize: 2300,
                requiredPosition: 2,
                restrictions: {
                    maxHp: 120,
                    maxWeight: 1600
                }
            }
        ]
    },
    {
        id: 'league-semi-pro',
        name: 'Semi-Pro League',
        class: 'Class C',
        tier: 2,
        description: 'Step up to higher speed circuits with stricter setup targets and tighter parity windows.',
        pointsTable: [20, 15, 12, 10, 8, 6, 4, 2, 1],
        events: [
            {
                id: 'event-semi-pro-grip-01',
                name: 'Hammerhead Sprint Cup',
                trackId: 't1',
                prize: 3200,
                requiredPosition: 3,
                restrictions: {
                    maxHp: 135,
                    maxWeight: 1525,
                    minTarmac: 45
                }
            },
            {
                id: 'event-semi-pro-rally-02',
                name: 'Canyon Technical Trial',
                trackId: 't4',
                prize: 3600,
                requiredPosition: 2,
                restrictions: {
                    maxHp: 140,
                    minDirt: 30,
                    maxTarmac: 85,
                    maxWeight: 1580
                }
            }
        ]
    }
];

let currentTrack = null;