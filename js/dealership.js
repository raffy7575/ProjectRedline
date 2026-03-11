/* =============================================================================
    js/dealership.js  —  Stock + rotating special-offer dealership system

    WHAT THIS FILE DOES
    - Defines procedural generator inputs (name parts, colors, archetypes)
    - Builds deterministic 15-minute rotating inventory from seed
    - Renders stock section and special-offer cards
    - Handles purchases and persistence for dealer-only cars

    SAFE THINGS TO EDIT
    - Rotation cadence: `DEALER_WINDOW_MS`
    - Archetype ranges/colors in `DEALER_ARCHETYPES`
    - Price formula in `_generateDealerCar()`
    - Countdown text in `updateDealerCountdown()`

    CAUTION
    - Generated IDs include seed window; changing ID format can affect save links.
    - Keep purchase flow updates (`playerData`, `cars`, save) in sync.
    ============================================================================= */

// ─── Procedural Dealership ────────────────────────────────────────────────────

const DEALER_WINDOW_MS = 15 * 60 * 1000; // 15-minute rotation window

const DEALER_PREFIXES = [
    'Apex', 'Storm', 'Shadow', 'Turbo', 'Nitro', 'Blaze', 'Ghost', 'Razor',
    'Flash', 'Fury', 'Steel', 'Iron', 'Crimson', 'Arctic', 'Thunder', 'Venom',
    'Phantom', 'Cobra', 'Eclipse', 'Havoc', 'Inferno', 'Obsidian', 'Volt',
    'Zenith', 'Rogue', 'Titan', 'Nova', 'Onyx', 'Specter', 'Carbon'
];

const DEALER_MODELS = [
    'Bullet', 'Ranger', 'Striker', 'Hunter', 'Bandit', 'Falcon', 'Wolf',
    'Eagle', 'Hawk', 'Tiger', 'Dragon', 'Panther', 'Cyclone', 'Tempest',
    'Comet', 'Meteor', 'Raptor', 'Vortex', 'Nemesis', 'Spectre',
    'Drifter', 'Prowler', 'Crusher', 'Dominator', 'Invader', 'Lynx',
    'Mamba', 'Phantom', 'Wraith', 'Reaper'
];

const DEALER_SUFFIXES = ['GT', 'RS', 'R', 'S', 'EVO', 'Pro', 'X', 'Ultra', 'SE', 'V8', 'TT', 'AWD', 'DTM'];

const DEALER_COLORS = [
    '#F44336', '#E91E63', '#9C27B0', '#3F51B5', '#2196F3', '#03BCD4',
    '#009688', '#4CAF50', '#8BC34A', '#FFC107', '#FF9800', '#FF5722',
    '#607D8B', '#00BCD4', '#8D6E63', '#455A64'
];

// Each archetype defines label, accent color and stat ranges [min, max]
const DEALER_ARCHETYPES = [
    {
        id: 'speed', label: 'SPD', color: '#2196F3',
        stats: { topSpeed: [88,99], acceleration: [55,75], braking: [48,68], handling: [42,62], dirt: [15,30], tarmac: [88,99] }
    },
    {
        id: 'grip', label: 'GRP', color: '#8BC34A',
        stats: { topSpeed: [62,80], acceleration: [65,84], braking: [82,99], handling: [85,99], dirt: [30,50], tarmac: [78,96] }
    },
    {
        id: 'balanced', label: 'BAL', color: '#9E9E9E',
        stats: { topSpeed: [74,88], acceleration: [74,88], braking: [70,86], handling: [70,86], dirt: [52,70], tarmac: [72,88] }
    },
    {
        id: 'offroad', label: 'DIRT', color: '#FF9800',
        stats: { topSpeed: [58,76], acceleration: [68,86], braking: [52,70], handling: [60,80], dirt: [88,99], tarmac: [28,45] }
    },
    {
        id: 'accel', label: 'ACC', color: '#FFC107',
        stats: { topSpeed: [72,88], acceleration: [88,99], braking: [58,76], handling: [52,70], dirt: [35,55], tarmac: [68,86] }
    }
];

// ── Seeded PRNG (xorshift-based) ──────────────────────────────────────────────

function _dealerRng(seed) {
    let s = (seed ^ 0xDEADBEEF) >>> 0;
    return function () {
        s = Math.imul(s ^ (s >>> 17), 0x45d9f3b) >>> 0;
        s = Math.imul(s ^ (s >>> 11), 0xac4a1d01) >>> 0;
        s = (s ^ (s >>> 16)) >>> 0;
        return (s >>> 0) / 0xFFFFFFFF;
    };
}

function _rint(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
}

function _rpick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}

function _generateGearRatios(rng, numGears) {
    let first = 3.0 + rng() * 1.0;
    let last  = 0.62 + rng() * 0.28;
    let ratios = [];
    for (let i = 0; i < numGears; i++) {
        let t = i / (numGears - 1);
        ratios.push(parseFloat((first * Math.pow(last / first, t)).toFixed(2)));
    }
    return ratios;
}

function _generateDealerCar(rng, index, seedKey) {
    // Creates one procedural car card with stats + physics data.
    // Name
    let prefix    = _rpick(rng, DEALER_PREFIXES);
    let model     = _rpick(rng, DEALER_MODELS);
    let hasSuffix = rng() > 0.42;
    let suffix    = hasSuffix ? ' ' + _rpick(rng, DEALER_SUFFIXES) : '';
    let name      = `${prefix} ${model}${suffix}`;

    // Color & archetype
    let color     = _rpick(rng, DEALER_COLORS);
    let archetype = _rpick(rng, DEALER_ARCHETYPES);

    // Stats from archetype ranges
    let baseStats = {};
    for (let [stat, [lo, hi]] of Object.entries(archetype.stats)) {
        baseStats[stat] = Math.min(95, _rint(rng, lo, hi));
    }

    // Physics params
    let hp          = _rint(rng, 480, 1100);
    let torque      = _rint(rng, 520, 980);
    let weight      = _rint(rng, 920, 1380);
    let dragCoeff   = parseFloat((0.22 + rng() * 0.14).toFixed(2));
    let gForceMax   = parseFloat((1.4 + rng() * 0.85).toFixed(2));
    let redline     = _rint(rng, 8000, 11500);
    let numGears    = rng() > 0.38 ? 6 : 7;
    let gearRatios  = _generateGearRatios(rng, numGears);
    let wheelRadius = parseFloat((0.28 + rng() * 0.07).toFixed(2));

    // Price: elite tier — prohibitive
    let statAvg = Object.values(baseStats).reduce((a, b) => a + b, 0) / 6;
    let price   = Math.round((38000 + statAvg * 480 + rng() * 22000) / 500) * 500;

    return {
        id: `dealer_${seedKey}_${index}`,
        name,
        color,
        price,
        upgrades: [],
        baseStats,
        hp,
        torque,
        weight,
        dragCoeff,
        gForceMax,
        redline,
        gearRatios,
        wheelRadius,
        archetype: archetype.id,
        archetypeLabel: archetype.label,
        archetypeColor: archetype.color,
        isDealer: true
    };
}

// ── Inventory cache ───────────────────────────────────────────────────────────

let _dealerCache = { seed: -1, inventory: [] };

function getDealerSeedKey() {
    return Math.floor(Date.now() / DEALER_WINDOW_MS);
}

function getDealerInventory() {
    // Cached by 15-minute seed so offers remain stable within each window.
    let seed = getDealerSeedKey();
    if (seed !== _dealerCache.seed) {
        _dealerCache.seed = seed;
        let rng = _dealerRng(seed);
        _dealerCache.inventory = [];
        for (let i = 0; i < 6; i++) {
            _dealerCache.inventory.push(_generateDealerCar(rng, i, seed));
        }
    }
    return _dealerCache.inventory;
}

function invalidateDealerCache() {
    _dealerCache.seed = -1;
    _dealerCache.inventory = [];
}

// ── Countdown timer ───────────────────────────────────────────────────────────

let _dealerTimerInterval = null;

function startDealerCountdownTimer() {
    if (_dealerTimerInterval) return;
    _dealerTimerInterval = setInterval(() => {
        let prevSeed = _dealerCache.seed;
        updateDealerCountdown();
        // Auto-rebuild when 15-min window rolls over
        if (_dealerCache.seed !== -1 && getDealerSeedKey() !== prevSeed) {
            invalidateDealerCache();
            buildDealership();
        }
    }, 1000);
}

function updateDealerCountdown() {
    const el = document.getElementById('dealer-countdown');
    if (!el) return;
    let now        = Date.now();
    let nextRefresh = (getDealerSeedKey() + 1) * DEALER_WINDOW_MS;
    let rem        = Math.max(0, nextRefresh - now);
    let m          = Math.floor(rem / 60000);
    let s          = Math.floor((rem % 60000) / 1000);
    el.textContent = `Refreshes in ${m}m ${s.toString().padStart(2, '0')}s`;
}

// ── Build UI ──────────────────────────────────────────────────────────────────

function _buildDealerCard(car, buyFn) {
    let isOwned   = playerData.ownedCars.includes(car.id);
    let canAfford = playerData.money >= car.price;
    let s         = car.baseStats;

    let badgeHTML = car.archetypeLabel
        ? `<span class="dealer-badge" style="background:${car.archetypeColor}">${car.archetypeLabel}</span>`
        : '';

    let specsHTML = car.hp
        ? `<div class="dealer-specs">${car.hp}hp &nbsp;·&nbsp; ${car.torque}nm &nbsp;·&nbsp; ${car.weight}kg &nbsp;·&nbsp; ${car.gearRatios.length}-spd &nbsp;·&nbsp; ${car.redline.toLocaleString()} rpm</div>`
        : '';

    let buyHTML = isOwned
        ? `<div class="buy-overlay"><div class="dealer-owned-tag">✓ In your garage</div></div>`
        : `<div class="buy-overlay">
               <button class="buy-btn" ${!canAfford ? 'disabled' : ''} onclick="${buyFn}('${car.id}', ${car.price})">
                   Buy for $${car.price.toLocaleString()}
               </button>
           </div>`;

    let isSpecialOffer = buyFn === 'buyDealerCar';
    let archetypeClass = car.archetype ? ` archetype-${car.archetype}` : '';

    let card = document.createElement('div');
    card.className = `car-card dealer-car${isOwned ? ' owned' : ''}${isSpecialOffer ? ' special-offer' : ''}${archetypeClass}`;
    card.id = `dealer-card-${car.id}`;
    if (car.archetypeColor) {
        card.style.borderTopColor = car.archetypeColor;
        card.style.borderTopWidth = '3px';
    }
    card.innerHTML = `
        <div class="car-name">
            <span style="color:${car.color}">■</span>
            ${car.name}
            ${badgeHTML}
        </div>
        ${specsHTML}
        ${generateStatHTML('Top Speed', s.topSpeed, s.topSpeed)}
        ${generateStatHTML('Acceleration', s.acceleration, s.acceleration)}
        ${generateStatHTML('Braking', s.braking, s.braking)}
        ${generateStatHTML('Handling', s.handling, s.handling)}
        ${generateStatHTML('Dirt', s.dirt, s.dirt)}
        ${buyHTML}
    `;
    return card;
}

function buildDealership() {
    // Rebuild both dealership sections: fixed stock + rotating special offers.
    // ── Stock section (fixed cars not yet owned) ──────────────────────────────
    const stockGrid = document.getElementById('stock-car-grid');
    if (stockGrid) {
        stockGrid.innerHTML = '';
        let stockCars = cars.filter(c => !c.isDealer);
        let availableStock = stockCars.filter(c => !playerData.ownedCars.includes(c.id));

        if (availableStock.length === 0) {
            stockGrid.innerHTML = '<div class="dealer-empty">All stock cars are in your garage.</div>';
        } else {
            availableStock.forEach(car => {
                let card = _buildDealerCard(car, 'buyCar');
                stockGrid.appendChild(card);
            });
        }
    }

    // ── Procedural rotating section (Special Offers) ─────────────────────────
    const dealerGrid = document.getElementById('dealer-car-grid');
    if (!dealerGrid) return;
    dealerGrid.innerHTML = '';

    const specialHeader = document.querySelector('.dealer-section-header');
    const countdownEl = document.getElementById('dealer-countdown');

    if (!isFeatureUnlocked('specialOffers')) {
        let unlockLabel = getFeatureUnlockLabel('specialOffers');
        if (specialHeader) specialHeader.style.display = 'none';
        dealerGrid.innerHTML = `<div class="dealer-locked-notice">&#128274; Special Offers ${unlockLabel}</div>`;
        if (countdownEl) countdownEl.style.display = 'none';
        return;
    }

    if (specialHeader) specialHeader.style.display = '';
    if (countdownEl) countdownEl.style.display = '';

    let inventory = getDealerInventory();
    inventory.forEach(car => {
        let card = _buildDealerCard(car, 'buyDealerCar');
        dealerGrid.appendChild(card);
    });

    updateDealerCountdown();
}

// ── Purchase ──────────────────────────────────────────────────────────────────

function buyDealerCar(carId) {
    // Purchase flow for generated special-offer vehicles.
    let inventory = getDealerInventory();
    let car = inventory.find(c => c.id === carId);
    if (!car || playerData.money < car.price) return;

    playerData.money -= car.price;
    playerData.ownedCars.push(car.id);

    // Persist purchased car so it survives save/load
    if (!playerData.dealerCars) playerData.dealerCars = [];
    if (!playerData.dealerCars.find(c => c.id === car.id)) {
        playerData.dealerCars.push({ ...car, upgrades: [] });
    }

    // Inject into global cars array for race/garage usage
    if (!cars.find(c => c.id === car.id)) {
        cars.push(car);
    }

    updateHUD();
    buildDealership();
    buildGarage();
    selectCar(car);

    // Navigate to Garage tab
    switchToTab('tab-garage');
    saveGameState();
}

// ── Helper: programmatic tab switch ──────────────────────────────────────────

function switchToTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) {
        openTab(tabId, btn);
    } else {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(tabId)?.classList.add('active');
    }
}
