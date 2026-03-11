function ensureAiCareerState() {
    ensureCareerProgress();

    if (!playerData.careerProgress.aiState || typeof playerData.careerProgress.aiState !== 'object') {
        playerData.careerProgress.aiState = {
            rivals: {},
            eventUpgradeFeed: {},
            lastProcessedEventId: null
        };
    }

    let aiState = playerData.careerProgress.aiState;
    if (!aiState.rivals || typeof aiState.rivals !== 'object') aiState.rivals = {};
    if (!aiState.eventUpgradeFeed || typeof aiState.eventUpgradeFeed !== 'object') aiState.eventUpgradeFeed = {};
    if (typeof aiState.lastProcessedEventId !== 'string') aiState.lastProcessedEventId = null;

    return aiState;
}

function flattenShopItems() {
    return Object.values(shopItems).flat();
}

function getAiRivalById(rivalId) {
    if (!Array.isArray(aiRivals)) return null;
    return aiRivals.find(rival => rival.id === rivalId) || null;
}

function getAiRivalByCarId(carId) {
    if (!Array.isArray(aiRivals)) return null;
    return aiRivals.find(rival => rival.carId === carId) || null;
}

function getAiRivalCar(rival) {
    if (!rival) return null;
    return cars.find(car => car.id === rival.carId) || null;
}

function createAiRivalState(rival) {
    return {
        rivalId: rival.id,
        money: 1000,
        ownedUpgradeIds: [],
        totalSpent: 0,
        lastPurchasedItemId: null,
        lastPurchasedEventId: null,
        lastBuildScore: 0
    };
}

function initializeAiCareerState() {
    let aiState = ensureAiCareerState();
    if (!Array.isArray(aiRivals)) return aiState;

    aiRivals.forEach(rival => {
        if (!aiState.rivals[rival.id] || typeof aiState.rivals[rival.id] !== 'object') {
            aiState.rivals[rival.id] = createAiRivalState(rival);
            return;
        }

        let s = aiState.rivals[rival.id];
        if (!Array.isArray(s.ownedUpgradeIds)) s.ownedUpgradeIds = [];
        if (!Number.isFinite(s.money)) s.money = 1000;
        if (!Number.isFinite(s.totalSpent)) s.totalSpent = 0;
        if (!Number.isFinite(s.lastBuildScore)) s.lastBuildScore = 0;
        if (typeof s.lastPurchasedItemId !== 'string') s.lastPurchasedItemId = null;
        if (typeof s.lastPurchasedEventId !== 'string') s.lastPurchasedEventId = null;
        s.rivalId = rival.id;
    });

    return aiState;
}

function getEventRestrictionSnapshot(event) {
    let r = event?.restrictions || {};
    return {
        maxHp: Number.isFinite(Number(r.maxHp)) ? Number(r.maxHp) : null,
        maxWeight: Number.isFinite(Number(r.maxWeight)) ? Number(r.maxWeight) : null,
        minDirt: Number.isFinite(Number(r.minDirt)) ? Number(r.minDirt) : null,
        maxDirt: Number.isFinite(Number(r.maxDirt)) ? Number(r.maxDirt) : null,
        minTarmac: Number.isFinite(Number(r.minTarmac)) ? Number(r.minTarmac) : null,
        maxTarmac: Number.isFinite(Number(r.maxTarmac)) ? Number(r.maxTarmac) : null
    };
}

function applyUpgradeIdsToBaseStats(baseCar, upgradeIds) {
    let stats = { ...(baseCar?.baseStats || {}) };
    let ids = Array.isArray(upgradeIds) ? upgradeIds : [];

    ids.forEach(id => {
        let item = flattenShopItems().find(x => x.id === id);
        if (!item || !item.boosts) return;

        Object.entries(item.boosts).forEach(([key, boost]) => {
            let original = Number(stats[key]) || 0;
            stats[key] = Math.max(0, Math.min(100, original + Number(boost || 0)));
        });
    });

    return stats;
}

function isStatsLegalForEvent(baseCar, stats, event) {
    let rule = getEventRestrictionSnapshot(event);
    let hp = Number(baseCar?.hp) || 0;
    let weight = Number(baseCar?.weight) || 0;
    let dirt = Number(stats?.dirt) || 0;
    let tarmac = Number(stats?.tarmac) || 0;

    if (rule.maxHp !== null && hp > rule.maxHp) return false;
    if (rule.maxWeight !== null && weight > rule.maxWeight) return false;
    if (rule.minDirt !== null && dirt < rule.minDirt) return false;
    if (rule.maxDirt !== null && dirt > rule.maxDirt) return false;
    if (rule.minTarmac !== null && tarmac < rule.minTarmac) return false;
    if (rule.maxTarmac !== null && tarmac > rule.maxTarmac) return false;

    return true;
}

function getBiasWeights(buildBias) {
    if (buildBias === 'power') {
        return { topSpeed: 0.30, acceleration: 0.30, handling: 0.12, braking: 0.10, dirt: 0.08, tarmac: 0.10 };
    }
    if (buildBias === 'grip') {
        return { topSpeed: 0.12, acceleration: 0.18, handling: 0.32, braking: 0.20, dirt: 0.08, tarmac: 0.10 };
    }
    if (buildBias === 'offroad') {
        return { topSpeed: 0.10, acceleration: 0.18, handling: 0.20, braking: 0.10, dirt: 0.32, tarmac: 0.10 };
    }
    return { topSpeed: 0.20, acceleration: 0.20, handling: 0.22, braking: 0.16, dirt: 0.10, tarmac: 0.12 };
}

function scoreStatsForEvent(stats, event, buildBias) {
    let track = getEventTrack(event);
    let weights = getBiasWeights(buildBias);

    let terrainTarmac = Number(track?.tarmac) || 0;
    let terrainDirt = Number(track?.dirt) || 0;
    let mixedSurfaceBoost = 1 + Math.min(0.15, Math.min(terrainTarmac, terrainDirt) * 0.3);

    let topSpeed = Number(stats?.topSpeed) || 0;
    let acceleration = Number(stats?.acceleration) || 0;
    let handling = Number(stats?.handling) || 0;
    let braking = Number(stats?.braking) || 0;
    let dirt = Number(stats?.dirt) || 0;
    let tarmac = Number(stats?.tarmac) || 0;

    let terrainAffinity = (tarmac * (0.45 + terrainTarmac * 0.55)) + (dirt * (0.45 + terrainDirt * 0.55));

    let baseScore =
        (topSpeed * weights.topSpeed) +
        (acceleration * weights.acceleration) +
        (handling * weights.handling) +
        (braking * weights.braking) +
        (dirt * weights.dirt) +
        (tarmac * weights.tarmac);

    return (baseScore * mixedSurfaceBoost) + (terrainAffinity * 0.08);
}

function selectBestLegalLoadout(baseCar, ownedUpgradeIds, event, buildBias, riskTolerance) {
    let allItems = flattenShopItems();
    let legalSet = [];
    let bestStats = applyUpgradeIdsToBaseStats(baseCar, legalSet);
    let bestScore = scoreStatsForEvent(bestStats, event, buildBias);

    let upgrades = [...new Set(ownedUpgradeIds || [])]
        .map(id => allItems.find(item => item.id === id))
        .filter(Boolean);

    upgrades.sort((a, b) => {
        let aPreview = applyUpgradeIdsToBaseStats(baseCar, [a.id]);
        let bPreview = applyUpgradeIdsToBaseStats(baseCar, [b.id]);
        return scoreStatsForEvent(bPreview, event, buildBias) - scoreStatsForEvent(aPreview, event, buildBias);
    });

    upgrades.forEach(item => {
        let nextSet = [...legalSet, item.id];
        let nextStats = applyUpgradeIdsToBaseStats(baseCar, nextSet);
        if (!isStatsLegalForEvent(baseCar, nextStats, event)) return;

        let nextScore = scoreStatsForEvent(nextStats, event, buildBias);
        let threshold = 0.10 + ((1 - Math.max(0, Math.min(1, Number(riskTolerance) || 0.6))) * 0.35);
        if (nextScore >= bestScore - threshold) {
            legalSet = nextSet;
            bestStats = nextStats;
            bestScore = nextScore;
        }
    });

    return { upgradeIds: legalSet, stats: bestStats, score: bestScore };
}

function evaluatePurchaseForRival(rival, rivalState, targetEvent) {
    let car = getAiRivalCar(rival);
    if (!car || !targetEvent) return null;

    let owned = [...new Set(rivalState.ownedUpgradeIds || [])];
    let currentBuild = selectBestLegalLoadout(car, owned, targetEvent, rival.buildBias, rival.riskTolerance);

    let affordableCandidates = flattenShopItems().filter(item => {
        return !owned.includes(item.id) && (Number(item.cost) || 0) <= (Number(rivalState.money) || 0);
    });

    let bestCandidate = null;
    affordableCandidates.forEach(item => {
        let testOwned = [...owned, item.id];
        let testBuild = selectBestLegalLoadout(car, testOwned, targetEvent, rival.buildBias, rival.riskTolerance);
        let gain = testBuild.score - currentBuild.score;

        if (!Number.isFinite(gain) || gain <= 0.2) return;

        if (!bestCandidate || gain > bestCandidate.gain) {
            bestCandidate = {
                item,
                gain,
                nextBuild: testBuild
            };
        }
    });

    if (!bestCandidate) return null;

    return {
        rival,
        item: bestCandidate.item,
        gain: bestCandidate.gain,
        currentBuild,
        nextBuild: bestCandidate.nextBuild
    };
}

function getLeagueEconomyIncome(leagueId, eventIndex) {
    let leagueIdx = getLeagueIndexById(leagueId);
    let safeLeagueIdx = leagueIdx >= 0 ? leagueIdx : 0;
    let safeEventIdx = Math.max(0, Number(eventIndex) || 0);

    return 650 + (safeLeagueIdx * 260) + (safeEventIdx * 110);
}

function applyAiIncomeForEvent(leagueId, eventIndex) {
    let aiState = initializeAiCareerState();
    let income = getLeagueEconomyIncome(leagueId, eventIndex);

    Object.keys(aiState.rivals).forEach(rivalId => {
        let state = aiState.rivals[rivalId];
        state.money = (Number(state.money) || 0) + income;
    });

    return income;
}

function getNextEventInLeague(leagueId, eventId) {
    let league = leagues.find(x => x.id === leagueId);
    if (!league || !Array.isArray(league.events)) return null;

    let idx = league.events.findIndex(e => e.id === eventId);
    if (idx < 0) return league.events[0] || null;
    if (idx + 1 < league.events.length) return league.events[idx + 1];
    return league.events[idx] || null;
}

function advanceAiAfterEvent(leagueId, eventId) {
    // Feature gate: AI upgrading is locked until Class C (tier 2)
    if (typeof isFeatureUnlocked === 'function' && !isFeatureUnlocked('aiUpgrades')) return [];

    let aiState = initializeAiCareerState();
    let league = leagues.find(x => x.id === leagueId);
    if (!league) return [];

    // Idempotency guard: don't process the same event twice (prevents replay farming)
    if (Object.prototype.hasOwnProperty.call(aiState.eventUpgradeFeed, eventId)) {
        return aiState.eventUpgradeFeed[eventId] || [];
    }

    let currentIndex = Math.max(0, league.events.findIndex(e => e.id === eventId));
    applyAiIncomeForEvent(leagueId, currentIndex);

    let targetEvent = getNextEventInLeague(leagueId, eventId);
    let upgradeFeed = [];

    aiRivals.forEach(rival => {
        let rivalState = aiState.rivals[rival.id] || createAiRivalState(rival);
        aiState.rivals[rival.id] = rivalState;

        let decision = evaluatePurchaseForRival(rival, rivalState, targetEvent);
        if (!decision) return;

        let cost = Number(decision.item.cost) || 0;
        if (cost > rivalState.money) return;

        rivalState.money -= cost;
        rivalState.totalSpent = (Number(rivalState.totalSpent) || 0) + cost;
        rivalState.ownedUpgradeIds = [...new Set([...(rivalState.ownedUpgradeIds || []), decision.item.id])];
        rivalState.lastPurchasedItemId = decision.item.id;
        rivalState.lastPurchasedEventId = eventId;
        rivalState.lastBuildScore = Number(decision.nextBuild.score) || 0;

        upgradeFeed.push({
            rivalId: rival.id,
            rivalName: rival.name,
            itemId: decision.item.id,
            itemName: decision.item.name,
            eventId,
            leagueId,
            spent: cost,
            gain: Number(decision.gain.toFixed(2))
        });
    });

    aiState.eventUpgradeFeed[eventId] = upgradeFeed;
    aiState.lastProcessedEventId = eventId;
    return upgradeFeed;
}

function getAiRivalLoadoutForEvent(rivalId, event) {
    let aiState = initializeAiCareerState();
    let rival = getAiRivalById(rivalId);
    if (!rival) return null;

    let baseCar = getAiRivalCar(rival);
    let rivalState = aiState.rivals[rival.id];
    if (!baseCar || !rivalState) return null;

    return selectBestLegalLoadout(
        baseCar,
        rivalState.ownedUpgradeIds || [],
        event,
        rival.buildBias,
        rival.riskTolerance
    );
}

function getAiUpgradeFeedForEvent(eventId) {
    let aiState = ensureAiCareerState();
    return aiState.eventUpgradeFeed[eventId] || [];
}

function getAiUpgradeFeedForLeague(leagueId) {
    let aiState = ensureAiCareerState();
    let out = [];

    Object.entries(aiState.eventUpgradeFeed || {}).forEach(([eventId, entries]) => {
        (entries || []).forEach(entry => {
            if (entry.leagueId === leagueId) {
                out.push({ ...entry, eventId });
            }
        });
    });

    out.sort((a, b) => (a.eventId || '').localeCompare(b.eventId || ''));
    return out;
}
