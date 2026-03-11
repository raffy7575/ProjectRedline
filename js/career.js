function ensureCareerProgress() {
    if (!playerData.careerProgress || typeof playerData.careerProgress !== 'object') {
        playerData.careerProgress = {
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
        };
    }

    if (!Array.isArray(playerData.careerProgress.unlockedLeagueIds)) {
        playerData.careerProgress.unlockedLeagueIds = ['league-amateur'];
    }
    if (!Array.isArray(playerData.careerProgress.completedEventIds)) {
        playerData.careerProgress.completedEventIds = [];
    }
    if (!playerData.careerProgress.bestPositions || typeof playerData.careerProgress.bestPositions !== 'object') {
        playerData.careerProgress.bestPositions = {};
    }
    if (!playerData.careerProgress.eventStatus || typeof playerData.careerProgress.eventStatus !== 'object') {
        playerData.careerProgress.eventStatus = {};
    }
    if (!playerData.careerProgress.leagueStandings || typeof playerData.careerProgress.leagueStandings !== 'object') {
        playerData.careerProgress.leagueStandings = {};
    }
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

    if (Array.isArray(leagues) && leagues.length && !playerData.careerProgress.unlockedLeagueIds.length) {
        playerData.careerProgress.unlockedLeagueIds.push(leagues[0].id);
    }

    return playerData.careerProgress;
}

// ── Progressive Disclosure / Feature Gating ───────────────────────────────────
//
// Feature requirements (minimum league tier needed):
//   1 = Class D (Amateur)  – core racing
//   2 = Class C (Street)   – tuning shop, AI upgrades
//   3 = Class B (Pro)      – wear & tear, rival intel
//   4 = Class A (Elite)    – special offers
//
// A feature is unlocked when the player has unlocked a league of at least that
// tier. We look at all unlocked leagues, not just completed ones, so reaching
// Class C immediately opens its features even before finishing it.

const FEATURE_REQUIREMENTS = {
    tuningShop:     2,
    aiUpgrades:     2,
    wearAndTear:    3,
    rivalIntel:     3,
    specialOffers:  4
};

function getHighestUnlockedLeagueTier() {
    ensureCareerProgress();
    let maxTier = 1;
    leagues.forEach(league => {
        if (isLeagueUnlocked(league.id)) {
            let t = Number(league.tier) || 1;
            if (t > maxTier) maxTier = t;
        }
    });
    return maxTier;
}

function isFeatureUnlocked(featureName) {
    let required = FEATURE_REQUIREMENTS[featureName];
    if (!Number.isFinite(required)) return true;
    return getHighestUnlockedLeagueTier() >= required;
}

function getFeatureUnlockLabel(featureName) {
    let required = FEATURE_REQUIREMENTS[featureName];
    if (!Number.isFinite(required)) return '';
    let league = leagues.find(l => (Number(l.tier) || 1) === required);
    return league ? `Unlocks at ${league.class}` : `Tier ${required} required`;
}

function formatPositionLabel(position) {
    let pos = Number(position);
    if (!Number.isFinite(pos) || pos <= 0) return '-';
    let v = Math.floor(pos);
    if (v % 100 >= 11 && v % 100 <= 13) return `${v}th`;
    if (v % 10 === 1) return `${v}st`;
    if (v % 10 === 2) return `${v}nd`;
    if (v % 10 === 3) return `${v}rd`;
    return `${v}th`;
}

function getEventRequiredPosition(event) {
    let required = Number(event?.requiredPosition);
    if (!Number.isFinite(required) || required <= 0) return 3;
    return Math.floor(required);
}

function didMeetEventPolicy(event, finishingPosition) {
    let requiredPosition = getEventRequiredPosition(event);
    let finish = Number(finishingPosition);
    if (!Number.isFinite(finish) || finish <= 0) return false;
    return Math.floor(finish) <= requiredPosition;
}

function getLeaguePointsTable(league) {
    if (Array.isArray(league?.pointsTable) && league.pointsTable.length) {
        return league.pointsTable;
    }
    return [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
}

function getPointsForPosition(position, pointsTable) {
    let idx = Math.floor(Number(position)) - 1;
    if (!Number.isFinite(idx) || idx < 0) return 0;
    return Number(pointsTable[idx]) || 0;
}

function getDriverIdFromRaceState(state) {
    if (state?.isPlayer) return 'player';
    return `ai:${state?.car?.id || 'unknown'}`;
}

function getDriverNameFromRaceState(state) {
    if (state?.isPlayer) return playerData.name || 'Player';
    let rival = Array.isArray(aiRivals) ? aiRivals.find(r => r.carId === state?.car?.id) : null;
    if (rival) return rival.name;
    return state?.car?.name ? `${state.car.name} AI` : 'AI Rival';
}

function ensureLeagueStandings(leagueId) {
    let progress = ensureCareerProgress();
    if (!progress.leagueStandings[leagueId] || typeof progress.leagueStandings[leagueId] !== 'object') {
        progress.leagueStandings[leagueId] = {};
    }
    return progress.leagueStandings[leagueId];
}

function ensureDriverStanding(leagueId, driverId, driverName) {
    let standings = ensureLeagueStandings(leagueId);
    if (!standings[driverId] || typeof standings[driverId] !== 'object') {
        standings[driverId] = {
            driverId,
            driverName,
            points: 0,
            races: 0,
            wins: 0,
            podiums: 0,
            bestFinish: null
        };
    } else if (driverName && standings[driverId].driverName !== driverName) {
        standings[driverId].driverName = driverName;
    }
    return standings[driverId];
}

function getLeagueStandings(leagueId) {
    let standings = ensureLeagueStandings(leagueId);
    let entries = Object.values(standings);
    if (!entries.find(e => e.driverId === 'player')) {
        entries.push(ensureDriverStanding(leagueId, 'player', playerData.name || 'Player'));
    }

    return entries.sort((a, b) => {
        if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        let bestA = Number.isFinite(a.bestFinish) ? a.bestFinish : 999;
        let bestB = Number.isFinite(b.bestFinish) ? b.bestFinish : 999;
        if (bestA !== bestB) return bestA - bestB;
        return (a.driverName || '').localeCompare(b.driverName || '');
    });
}

function getLeagueIndexById(leagueId) {
    return leagues.findIndex(league => league.id === leagueId);
}

function getActiveLeague() {
    if (!Array.isArray(leagues) || !leagues.length) return null;

    ensureCareerProgress();

    let unlockedLeagues = leagues.filter(league => isLeagueUnlocked(league.id));
    let inProgress = unlockedLeagues.find(league => !isLeagueCompleted(league.id));
    return inProgress || unlockedLeagues[0] || leagues[0];
}

function getTrackById(trackId) {
    return tracks.find(track => track.id === trackId) || null;
}

function getEventTrack(event) {
    if (!event || !event.trackId) return null;
    return getTrackById(event.trackId);
}

function getCareerEventById(eventId) {
    if (!eventId || !Array.isArray(leagues)) return null;

    for (let i = 0; i < leagues.length; i++) {
        let events = leagues[i]?.events || [];
        let found = events.find(event => event.id === eventId);
        if (found) return found;
    }

    return null;
}

function getCareerEventContext(eventId) {
    if (!eventId || !Array.isArray(leagues)) return null;

    for (let leagueIndex = 0; leagueIndex < leagues.length; leagueIndex++) {
        let league = leagues[leagueIndex];
        let events = league?.events || [];

        for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
            let event = events[eventIndex];
            if (event.id === eventId) {
                return { league, leagueIndex, event, eventIndex };
            }
        }
    }

    return null;
}

function isLeagueUnlocked(leagueId) {
    let progress = ensureCareerProgress();
    return progress.unlockedLeagueIds.includes(leagueId);
}

function isEventCompleted(eventId) {
    let progress = ensureCareerProgress();
    return progress.completedEventIds.includes(eventId);
}

function getEventBestPosition(eventId) {
    let progress = ensureCareerProgress();
    let pos = Number(progress.bestPositions[eventId]);
    return Number.isFinite(pos) && pos > 0 ? Math.floor(pos) : null;
}

function isLeagueCompleted(leagueId) {
    let league = leagues.find(item => item.id === leagueId);
    if (!league || !Array.isArray(league.events) || !league.events.length) return false;

    return league.events.every(event => isEventCompleted(event.id));
}

function isEventUnlocked(league, eventIndex) {
    if (!league || !Array.isArray(league.events)) return false;
    if (!isLeagueUnlocked(league.id)) return false;
    if (eventIndex <= 0) return true;

    for (let i = 0; i < eventIndex; i++) {
        if (!isEventCompleted(league.events[i].id)) return false;
    }
    return true;
}

function unlockNextLeagueIfEligible(completedLeagueId) {
    let completedLeagueIndex = getLeagueIndexById(completedLeagueId);
    if (completedLeagueIndex < 0) return false;

    let nextLeague = leagues[completedLeagueIndex + 1];
    if (!nextLeague) return false;
    if (!isLeagueCompleted(completedLeagueId)) return false;

    let progress = ensureCareerProgress();
    if (!progress.unlockedLeagueIds.includes(nextLeague.id)) {
        progress.unlockedLeagueIds.push(nextLeague.id);
        return true;
    }

    return false;
}

function recordCareerRaceResult(eventId, finishingPosition, sortedRacers) {
    let context = getCareerEventContext(eventId);
    if (!context) {
        return { eventCompleted: false, targetMet: false, leagueCompleted: false, unlockedLeagueId: null, pointsAwarded: 0 };
    }

    let progress = ensureCareerProgress();
    let requiredPosition = getEventRequiredPosition(context.event);
    let targetMet = didMeetEventPolicy(context.event, finishingPosition);

    let newlyCompleted = false;
    if (targetMet && !progress.completedEventIds.includes(eventId)) {
        progress.completedEventIds.push(eventId);
        newlyCompleted = true;
    }

    let finish = Number(finishingPosition);
    if (Number.isFinite(finish) && finish > 0) {
        let previousBest = getEventBestPosition(eventId);
        if (!previousBest || finish < previousBest) {
            progress.bestPositions[eventId] = Math.floor(finish);
        }
    }

    if (!progress.eventStatus[eventId] || typeof progress.eventStatus[eventId] !== 'object') {
        progress.eventStatus[eventId] = {
            attempts: 0,
            requiredPosition,
            targetMet: false,
            lastPosition: null,
            pointsAwardedLast: 0,
            pointsAwardedBest: 0,
            standingsApplied: false
        };
    }
    let status = progress.eventStatus[eventId];
    status.attempts = (Number(status.attempts) || 0) + 1;
    status.requiredPosition = requiredPosition;
    status.targetMet = Boolean(status.targetMet || targetMet);
    status.lastPosition = Number.isFinite(finish) && finish > 0 ? Math.floor(finish) : null;

    let standings = ensureLeagueStandings(context.league.id);
    let pointsTable = getLeaguePointsTable(context.league);
    let pointsAwarded = 0;
    let shouldApplyStandings = !status.standingsApplied;
    if (shouldApplyStandings && Array.isArray(sortedRacers) && sortedRacers.length) {
        sortedRacers.forEach((state, idx) => {
            let pos = idx + 1;
            let pts = getPointsForPosition(pos, pointsTable);
            let driverId = getDriverIdFromRaceState(state);
            let driverName = getDriverNameFromRaceState(state);
            let standing = ensureDriverStanding(context.league.id, driverId, driverName);

            standing.points = (Number(standing.points) || 0) + pts;
            standing.races = (Number(standing.races) || 0) + 1;
            if (pos === 1) standing.wins = (Number(standing.wins) || 0) + 1;
            if (pos <= 3) standing.podiums = (Number(standing.podiums) || 0) + 1;
            if (!Number.isFinite(standing.bestFinish) || pos < standing.bestFinish) {
                standing.bestFinish = pos;
            }

            standings[driverId] = standing;
            if (state?.isPlayer) pointsAwarded = pts;
        });
    } else if (shouldApplyStandings) {
        pointsAwarded = getPointsForPosition(finish, pointsTable);
        let playerStanding = ensureDriverStanding(context.league.id, 'player', playerData.name || 'Player');
        playerStanding.points = (Number(playerStanding.points) || 0) + pointsAwarded;
        playerStanding.races = (Number(playerStanding.races) || 0) + 1;
        if (finish === 1) playerStanding.wins = (Number(playerStanding.wins) || 0) + 1;
        if (finish <= 3) playerStanding.podiums = (Number(playerStanding.podiums) || 0) + 1;
        if (!Number.isFinite(playerStanding.bestFinish) || finish < playerStanding.bestFinish) {
            playerStanding.bestFinish = finish;
        }
        standings.player = playerStanding;
    }

    if (shouldApplyStandings) {
        status.standingsApplied = true;
    }

    status.pointsAwardedLast = pointsAwarded;
    status.pointsAwardedBest = Math.max(Number(status.pointsAwardedBest) || 0, pointsAwarded);

    let leagueCompleted = isLeagueCompleted(context.league.id);
    let unlockedLeagueId = null;
    if (leagueCompleted) {
        let changed = unlockNextLeagueIfEligible(context.league.id);
        if (changed) {
            let nextLeague = leagues[context.leagueIndex + 1];
            unlockedLeagueId = nextLeague ? nextLeague.id : null;
        }
    }

    return {
        eventCompleted: newlyCompleted,
        targetMet,
        requiredPosition,
        pointsAwarded,
        leagueCompleted,
        unlockedLeagueId
    };
}

function getRestrictionLabel(key, limit) {
    if (key === 'maxHp') return `Max ${limit} HP`;
    if (key === 'maxWeight') return `Max ${limit} kg`;
    if (key === 'minDirt') return `Min ${limit} Dirt`;
    if (key === 'maxDirt') return `Max ${limit} Dirt`;
    if (key === 'minTarmac') return `Min ${limit} Tarmac`;
    if (key === 'maxTarmac') return `Max ${limit} Tarmac`;
    return `${key}: ${limit}`;
}

function normalizeCarForInspection(car) {
    if (!car) return null;

    let activeStats = getCarStats(car);
    return {
        id: car.id,
        name: car.name,
        hp: Number(car.hp) || 0,
        weight: Number(car.weight) || 0,
        dirt: Number(activeStats.dirt) || 0,
        tarmac: Number(activeStats.tarmac) || 0
    };
}

function validateCarForEvent(car, event) {
    let targetCar = car || selectedPlayerCar;
    let restrictions = event?.restrictions || {};
    let normalizedCar = normalizeCarForInspection(targetCar);

    if (!normalizedCar) {
        return {
            isEligible: false,
            checks: Object.entries(restrictions).map(([key, limit]) => ({
                key,
                label: getRestrictionLabel(key, limit),
                limit,
                actual: null,
                passed: false
            }))
        };
    }

    let checks = Object.entries(restrictions).map(([key, limit]) => {
        let actual = null;
        let passed = false;

        if (key === 'maxHp') {
            actual = normalizedCar.hp;
            passed = actual <= limit;
        } else if (key === 'maxWeight') {
            actual = normalizedCar.weight;
            passed = actual <= limit;
        } else if (key === 'minDirt') {
            actual = normalizedCar.dirt;
            passed = actual >= limit;
        } else if (key === 'maxDirt') {
            actual = normalizedCar.dirt;
            passed = actual <= limit;
        } else if (key === 'minTarmac') {
            actual = normalizedCar.tarmac;
            passed = actual >= limit;
        } else if (key === 'maxTarmac') {
            actual = normalizedCar.tarmac;
            passed = actual <= limit;
        }

        return {
            key,
            label: getRestrictionLabel(key, limit),
            limit,
            actual,
            passed
        };
    });

    return {
        isEligible: checks.every(check => check.passed),
        checks
    };
}
