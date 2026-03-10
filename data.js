let playerData = { 
    name: 'Driver',
    money: 10000, 
    ownedCars: [], 
    skills: {
        shifting: { level: 0, max: 10, baseCost: 1000, name: "Power Shifting", desc: "Improves gear shifts.", effect: "+2% Acceleration per level" },
        cornering: { level: 0, max: 10, baseCost: 1200, name: "Apex Precision", desc: "Better racing lines.", effect: "+2% Handling per level" },
        braking: { level: 0, max: 10, baseCost: 800, name: "Trail Braking", desc: "Late braking technique.", effect: "+2% Braking per level" }
    }
};

const cars = [
    { 
        id: 'c1', 
        name: "Apex Bullet", 
        price: 8500, 
        color: "#F44336", 
        upgrades: [], 
        baseStats: { topSpeed: 72, acceleration: 58, braking: 45, handling: 42, dirt: 35, tarmac: 88 },
        hp: 350,
        torque: 380,
        weight: 1250,
        dragCoeff: 0.32,
        gForceMax: 1.2,
        redline: 8200, // Motor rotativo para Top Speed
        gearRatios: [3.5, 2.1, 1.5, 1.1, 0.85, 0.7], // 6 Mudanças
        wheelRadius: 0.32
    },
    { 
        id: 'c2', 
        name: "Grip Master", 
        price: 9000, 
        color: "#2196F3", 
        upgrades: [], 
        baseStats: { topSpeed: 55, acceleration: 52, braking: 68, handling: 72, dirt: 40, tarmac: 75 },
        hp: 280,
        torque: 350,
        weight: 1400,
        dragCoeff: 0.35,
        gForceMax: 1.4,
        redline: 7800,
        gearRatios: [3.8, 2.3, 1.6, 1.2, 0.95, 0.8], // 6 Mudanças (mais curtas)
        wheelRadius: 0.32
    },
    { 
        id: 'c3', 
        name: "Dusty Ranger", 
        price: 8000, 
        color: "#FF9800", 
        upgrades: [], 
        baseStats: { topSpeed: 60, acceleration: 55, braking: 48, handling: 50, dirt: 80, tarmac: 38 },
        hp: 320,
        torque: 400,
        weight: 1350,
        dragCoeff: 0.40,
        gForceMax: 1.1,
        redline: 7000, // Motor de Rally, muita força mas corta cedo
        gearRatios: [3.2, 1.9, 1.4, 1.0, 0.75], // 5 Mudanças
        wheelRadius: 0.32
    }
];

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
        { id: 'wgt1', name: 'Stripped Interior', cost: 800, boosts: { acceleration: 5, handling: 5, braking: 5 } },
        { id: 'wgt2', name: 'Carbon Fiber Panels', cost: 4000, boosts: { acceleration: 12, handling: 10, braking: 10 } }
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

const tracks = [
    { id: 't1', name: "Hammerhead", laps: 7, tarmac: 1.0, dirt: 0.0, waypoints: [ {x:0.1, y:0.2}, {x:0.8, y:0.2}, {x:0.9, y:0.4}, {x:0.7, y:0.6}, {x:0.9, y:0.8}, {x:0.5, y:0.9}, {x:0.4, y:0.6}, {x:0.2, y:0.7}, {x:0.1, y:0.5} ] },
    { id: 't2', name: "The Serpent", laps: 5, tarmac: 0.9, dirt: 0.1, waypoints: [ {x:0.2, y:0.1}, {x:0.8, y:0.1}, {x:0.8, y:0.3}, {x:0.2, y:0.4}, {x:0.2, y:0.6}, {x:0.8, y:0.7}, {x:0.8, y:0.9}, {x:0.1, y:0.9}, {x:0.05, y:0.5} ] },
    { id: 't3', name: "Dragon's Tail", laps: 4, tarmac: 0.5, dirt: 0.5, waypoints: [ {x:0.1, y:0.5}, {x:0.9, y:0.1}, {x:0.9, y:0.9}, {x:0.7, y:0.8}, {x:0.6, y:0.9}, {x:0.4, y:0.7}, {x:0.2, y:0.9} ] },
    { id: 't4', name: "Muddy Canyon", laps: 4, tarmac: 0.2, dirt: 0.8, waypoints: [ {x:0.1, y:0.8}, {x:0.2, y:0.2}, {x:0.8, y:0.2}, {x:0.9, y:0.8}, {x:0.5, y:0.5} ] } 
];

let currentTrack = null;