// Tuning catalogue.
//
// Two kinds of category:
//   staged  - parts build on each other; only the highest EQUIPPED stage applies,
//             and you must own stage N-1 before buying stage N.
//   choice  - pick exactly one (tyre compounds). Index 0 is the free stock option.
//
// `cost` is the Class D price; other classes multiply it (see CLASS_INFO).
// `fx` values are totals for that stage, not increments.

export const UPGRADE_CATEGORIES = [
    {
        id: 'engine', name: 'Engine', mode: 'staged', icon: '⚙',
        items: [
            { id: 'eng1', name: 'Sport Air Filter', cost: 350, fx: { powerPct: 4 } },
            { id: 'eng2', name: 'ECU Remap', cost: 1100, fx: { powerPct: 10 } },
            { id: 'eng3', name: 'Forged Internals', cost: 3200, fx: { powerPct: 18, redline: 400 } }
        ]
    },
    {
        id: 'turbo', name: 'Forced Induction', mode: 'staged', icon: '🌀',
        items: [
            { id: 'tur1', name: 'Stage 1 Turbo', cost: 2000, fx: { powerPct: 13, weight: 12 } },
            { id: 'tur2', name: 'Twin Turbo Kit', cost: 4800, fx: { powerPct: 26, weight: 22 } }
        ]
    },
    {
        id: 'exhaust', name: 'Exhaust', mode: 'staged', icon: '💨',
        items: [
            { id: 'exh1', name: 'Straight Pipe', cost: 450, fx: { powerPct: 2.5, weight: -4 } },
            { id: 'exh2', name: 'Titanium Exhaust', cost: 1600, fx: { powerPct: 5, weight: -12 } }
        ]
    },
    {
        id: 'weight', name: 'Weight Reduction', mode: 'staged', icon: '🪶',
        items: [
            { id: 'wgt1', name: 'Stripped Interior', cost: 800, fx: { weight: -45 } },
            { id: 'wgt2', name: 'Carbon Fibre Panels', cost: 3800, fx: { weight: -110 } }
        ]
    },
    {
        id: 'tyres', name: 'Tyres', mode: 'choice', icon: '⭕',
        items: [
            { id: 'tir0', name: 'Street', cost: 0, fx: {} },
            { id: 'tir3', name: 'Sport', cost: 900, fx: { grip: 0.06, dirtGrip: -0.02 } },
            { id: 'tir1', name: 'Semi-Slick', cost: 2200, fx: { grip: 0.13, dirtGrip: -0.08 } },
            { id: 'tir2', name: 'Rally Gravel', cost: 1000, fx: { grip: -0.05, dirtGrip: 0.24 } }
        ]
    },
    {
        id: 'suspension', name: 'Suspension', mode: 'staged', icon: '🔩',
        items: [
            { id: 'sus1', name: 'Lowering Springs', cost: 500, fx: { grip: 0.03, dirtGrip: -0.02 } },
            { id: 'sus2', name: 'Track Coilovers', cost: 2400, fx: { grip: 0.07, dirtGrip: -0.05 } }
        ]
    },
    {
        id: 'brakes', name: 'Brakes', mode: 'staged', icon: '🛑',
        items: [
            { id: 'brk1', name: 'Slotted Rotors', cost: 600, fx: { brake: 0.10 } },
            { id: 'brk2', name: 'Carbon Ceramic Kit', cost: 2900, fx: { brake: 0.24, weight: -8 } }
        ]
    },
    {
        id: 'aero', name: 'Aero', mode: 'staged', icon: '🛩',
        items: [
            { id: 'aer1', name: 'Front Splitter', cost: 700, fx: { clA: 0.18, cdA: 0.01 } },
            { id: 'aer2', name: 'GT Wing Kit', cost: 2600, fx: { clA: 0.50, cdA: 0.05 } }
        ]
    },
    {
        id: 'gearbox', name: 'Gearbox', mode: 'staged', icon: '🕹',
        items: [
            { id: 'gbx1', name: 'Short Shifter', cost: 500, fx: { shiftTime: 0.7 } },
            { id: 'gbx2', name: 'Sequential Box', cost: 3000, fx: { shiftTime: 0.35 } }
        ]
    },
    {
        id: 'nitro', name: 'Nitrous', mode: 'staged', icon: '🔥',
        items: [
            { id: 'nit1', name: 'Larger Bottle', cost: 900, fx: { nitroCap: 2 } },
            { id: 'nit2', name: 'Race Nitrous', cost: 2600, fx: { nitroCap: 3.5, nitroPower: 0.08 } }
        ]
    }
];

const ITEM_INDEX = new Map();
UPGRADE_CATEGORIES.forEach(cat => cat.items.forEach((item, stage) => {
    ITEM_INDEX.set(item.id, { item, category: cat, stage });
}));

export function findUpgrade(itemId) {
    return ITEM_INDEX.get(itemId) || null;
}

export function allUpgradeItems() {
    return [...ITEM_INDEX.values()];
}
