// Car catalogue. Every value here is a real-world style spec; the simulation
// derives acceleration, top speed, cornering and lap time from these numbers.
//
//   hp / weight      engine power and kerb weight (kg)
//   grip / dirtGrip  tyre friction coefficient on tarmac / on dirt
//   brake            braking hardware limit in g
//   cdA / clA        aerodynamic drag area / downforce area (m²)
//
// IDs are stored in save files: never rename an existing id.

export const CAR_CLASSES = ['D', 'C', 'B', 'A'];

export const CLASS_INFO = {
    D: { label: 'Class D', color: '#58b4ff', piCap: 300, upgradeCostMul: 1, serviceMul: 1 },
    C: { label: 'Class C', color: '#5fd38d', piCap: 400, upgradeCostMul: 2.4, serviceMul: 2 },
    B: { label: 'Class B', color: '#ffc247', piCap: 520, upgradeCostMul: 5.5, serviceMul: 4 },
    A: { label: 'Class A', color: '#ff5a4d', piCap: 680, upgradeCostMul: 12, serviceMul: 8 }
};

export const CARS = [
    // ── Class D: starter cars ────────────────────────────────────────────────
    {
        id: 'c1', name: 'Apex Bullet', cls: 'D', price: 2800, color: '#f44336', body: 'hatch', drivetrain: 'FWD',
        hp: 98, weight: 960, redline: 6800, gears: 5, cdA: 0.66, clA: 0.05, grip: 0.90, dirtGrip: 0.52, brake: 0.92,
        blurb: 'Light, eager hot hatch. The all-rounder of the amateur grid.'
    },
    {
        id: 'c2', name: 'Grip Master', cls: 'D', price: 3200, color: '#2196f3', body: 'coupe', drivetrain: 'FWD',
        hp: 86, weight: 900, redline: 7200, gears: 5, cdA: 0.64, clA: 0.14, grip: 0.98, dirtGrip: 0.50, brake: 1.02,
        blurb: 'Down on power, but nothing in Class D carries more corner speed.'
    },
    {
        id: 'c3', name: 'Dusty Ranger', cls: 'D', price: 2600, color: '#ff9800', body: 'rally', drivetrain: 'AWD',
        hp: 106, weight: 1130, redline: 6200, gears: 5, cdA: 0.72, clA: 0.03, grip: 0.86, dirtGrip: 0.76, brake: 0.90,
        blurb: 'All-wheel drive and knobbly tyres. Slow on tarmac, king of the dirt.'
    },
    {
        id: 'd4', name: 'Kettle 1.8', cls: 'D', price: 3000, color: '#9c7bff', body: 'sedan', drivetrain: 'RWD',
        hp: 122, weight: 1090, redline: 6400, gears: 5, cdA: 0.70, clA: 0.02, grip: 0.87, dirtGrip: 0.55, brake: 0.90,
        blurb: 'Old rear-drive saloon with the biggest engine in class. Fast in a straight line.'
    },

    // ── Class C ──────────────────────────────────────────────────────────────
    {
        id: 'c-hornet', name: 'Volt Hornet', cls: 'C', price: 11500, color: '#ffd400', body: 'hatch', drivetrain: 'FWD',
        hp: 198, weight: 1190, redline: 7000, gears: 6, cdA: 0.66, clA: 0.12, grip: 1.01, dirtGrip: 0.54, brake: 1.08,
        blurb: 'Turbo hatch with sharp brakes. Forgiving and quick everywhere.'
    },
    {
        id: 'c-kaido', name: 'Kaido RS', cls: 'C', price: 12800, color: '#e91e63', body: 'coupe', drivetrain: 'RWD',
        hp: 214, weight: 1240, redline: 7800, gears: 6, cdA: 0.62, clA: 0.18, grip: 1.03, dirtGrip: 0.52, brake: 1.06,
        blurb: 'High-revving rear-drive coupe. A tuner favourite.'
    },
    {
        id: 'c-ridge', name: 'Ridge Hawk', cls: 'C', price: 13500, color: '#4caf50', body: 'rally', drivetrain: 'AWD',
        hp: 228, weight: 1330, redline: 6600, gears: 6, cdA: 0.70, clA: 0.10, grip: 0.97, dirtGrip: 0.82, brake: 1.04,
        blurb: 'Rally-bred AWD. Untouchable when the tarmac ends.'
    },
    {
        id: 'c-brawler', name: 'Brawler 302', cls: 'C', price: 12000, color: '#ff5722', body: 'muscle', drivetrain: 'RWD',
        hp: 292, weight: 1590, redline: 6200, gears: 5, cdA: 0.78, clA: 0.04, grip: 0.95, dirtGrip: 0.50, brake: 0.98,
        blurb: 'V8 muscle. Wins drag races, loses arguments with corners.'
    },

    // ── Class B ──────────────────────────────────────────────────────────────
    {
        id: 'b-specter', name: 'Specter GT', cls: 'B', price: 38000, color: '#607d8b', body: 'coupe', drivetrain: 'RWD',
        hp: 395, weight: 1430, redline: 7400, gears: 6, cdA: 0.64, clA: 0.42, grip: 1.10, dirtGrip: 0.52, brake: 1.20,
        blurb: 'Grand tourer with real pace. Stable, fast and brutally consistent.'
    },
    {
        id: 'b-venom', name: 'Stratos Venom', cls: 'B', price: 42000, color: '#00bcd4', body: 'super', drivetrain: 'RWD',
        hp: 335, weight: 1120, redline: 8200, gears: 6, cdA: 0.60, clA: 0.55, grip: 1.16, dirtGrip: 0.50, brake: 1.28,
        blurb: 'Mid-engined featherweight. Corners like it is on rails.'
    },
    {
        id: 'b-tundra', name: 'Tundra Evo', cls: 'B', price: 40000, color: '#8bc34a', body: 'rally', drivetrain: 'AWD',
        hp: 410, weight: 1470, redline: 7000, gears: 6, cdA: 0.70, clA: 0.35, grip: 1.08, dirtGrip: 0.86, brake: 1.18,
        blurb: 'Homologation special. Launches hard on any surface.'
    },
    {
        id: 'b-colossus', name: 'Colossus SRT', cls: 'B', price: 36000, color: '#b71c1c', body: 'muscle', drivetrain: 'RWD',
        hp: 525, weight: 1780, redline: 6400, gears: 6, cdA: 0.80, clA: 0.15, grip: 1.04, dirtGrip: 0.50, brake: 1.12,
        blurb: 'Supercharged sledgehammer. Needs long straights and a brave driver.'
    },

    // ── Class A ──────────────────────────────────────────────────────────────
    {
        id: 'a-zenith', name: 'Zenith R', cls: 'A', price: 125000, color: '#eceff1', body: 'coupe', drivetrain: 'AWD',
        hp: 645, weight: 1540, redline: 7600, gears: 7, cdA: 0.66, clA: 0.95, grip: 1.21, dirtGrip: 0.60, brake: 1.42,
        blurb: 'All-weather supercar. Devastating traction out of slow corners.'
    },
    {
        id: 'a-phantom', name: 'Phantom LM', cls: 'A', price: 165000, color: '#7c4dff', body: 'super', drivetrain: 'RWD',
        hp: 715, weight: 1290, redline: 8800, gears: 7, cdA: 0.70, clA: 1.70, grip: 1.27, dirtGrip: 0.50, brake: 1.55,
        blurb: 'Le Mans prototype for the road. Downforce does the talking.'
    },
    {
        id: 'a-hyperion', name: 'Nova Hyperion', cls: 'A', price: 240000, color: '#ff1744', body: 'super', drivetrain: 'AWD',
        hp: 930, weight: 1420, redline: 8400, gears: 7, cdA: 0.68, clA: 1.35, grip: 1.29, dirtGrip: 0.52, brake: 1.58,
        blurb: 'The apex predator. If you can afford it, you have already won.'
    }
];

export const PAINT_COLORS = [
    '#f44336', '#ff1744', '#e91e63', '#9c27b0', '#7c4dff', '#3f51b5', '#2196f3', '#00bcd4',
    '#009688', '#4caf50', '#8bc34a', '#ffd400', '#ff9800', '#ff5722', '#eceff1', '#607d8b', '#263238'
];
