const SAVE_KEY = 'projectRedlineSaveV1';
const BASE_SKILLS_TEMPLATE = JSON.parse(JSON.stringify(playerData.skills));

function cloneSkillsTemplate() {
    return JSON.parse(JSON.stringify(BASE_SKILLS_TEMPLATE));
}

function sanitizePlayerName(name) {
    if (typeof name !== 'string') return 'Driver';
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 24) : 'Driver';
}

function askPlayerName(initialName) {
    return new Promise((resolve) => {
        const suggested = sanitizePlayerName(initialName || 'Driver');
        const overlay = document.getElementById('name-modal-overlay');
        const input = document.getElementById('driver-name-input');
        
        overlay.style.display = 'flex';
        input.value = suggested;
        input.focus();
        input.select();
        
        // Função para submeter o nome
        window.submitDriverName = function() {
            let entered = sanitizePlayerName(input.value || suggested);
            if (!entered) {
                entered = 'Driver';
            }
            overlay.style.display = 'none';
            resolve(entered);
        };
        
        // Permitir submit com Enter
        input.onkeypress = function(e) {
            if (e.key === 'Enter') {
                window.submitDriverName();
            }
        };
    });
}

function buildSavePayload() {
    const carsUpgrades = {};
    cars.forEach(car => {
        carsUpgrades[car.id] = Array.isArray(car.upgrades) ? [...car.upgrades] : [];
    });

    return {
        version: 4,
        savedAt: Date.now(),
        playerData: {
            name: sanitizePlayerName(playerData.name),
            money: Number(playerData.money) || 0,
            ownedCars: Array.isArray(playerData.ownedCars) ? [...playerData.ownedCars] : [],
            carCondition: JSON.parse(JSON.stringify(playerData.carCondition || {})),
            dealerCars: Array.isArray(playerData.dealerCars) ? JSON.parse(JSON.stringify(playerData.dealerCars)) : [],
            careerProgress: JSON.parse(JSON.stringify(playerData.careerProgress || {})),
            skills: JSON.parse(JSON.stringify(playerData.skills || {}))
        },
        selectedCarId: selectedPlayerCar ? selectedPlayerCar.id : null,
        carsUpgrades
    };
}

function saveGameState() {
    try {
        const payload = buildSavePayload();
        localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('Could not save game state:', error);
    }
}

function loadGameState() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;

        const save = JSON.parse(raw);
        if (!save || typeof save !== 'object' || !save.playerData) return false;

        const fallbackSkills = cloneSkillsTemplate();

        playerData.name = sanitizePlayerName(save.playerData.name);
        playerData.money = Number.isFinite(save.playerData.money) ? save.playerData.money : playerData.money;
        playerData.ownedCars = Array.isArray(save.playerData.ownedCars) ? [...save.playerData.ownedCars] : [];
        playerData.carCondition = (save.playerData.carCondition && typeof save.playerData.carCondition === 'object')
            ? JSON.parse(JSON.stringify(save.playerData.carCondition))
            : {};
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
        if (save.playerData.careerProgress && typeof save.playerData.careerProgress === 'object') {
            const cp = save.playerData.careerProgress;
            playerData.careerProgress.unlockedLeagueIds = Array.isArray(cp.unlockedLeagueIds)
                ? [...cp.unlockedLeagueIds]
                : ['league-amateur'];
            playerData.careerProgress.completedEventIds = Array.isArray(cp.completedEventIds)
                ? [...cp.completedEventIds]
                : [];
            playerData.careerProgress.bestPositions = (cp.bestPositions && typeof cp.bestPositions === 'object')
                ? JSON.parse(JSON.stringify(cp.bestPositions))
                : {};
            playerData.careerProgress.eventStatus = (cp.eventStatus && typeof cp.eventStatus === 'object')
                ? JSON.parse(JSON.stringify(cp.eventStatus))
                : {};
            playerData.careerProgress.leagueStandings = (cp.leagueStandings && typeof cp.leagueStandings === 'object')
                ? JSON.parse(JSON.stringify(cp.leagueStandings))
                : {};
            playerData.careerProgress.aiState = (cp.aiState && typeof cp.aiState === 'object')
                ? JSON.parse(JSON.stringify(cp.aiState))
                : {
                    rivals: {},
                    eventUpgradeFeed: {},
                    lastProcessedEventId: null
                };
        }

        // Restore purchased dealer cars and re-inject into global cars array
        playerData.dealerCars = Array.isArray(save.playerData.dealerCars)
            ? JSON.parse(JSON.stringify(save.playerData.dealerCars))
            : [];
        playerData.dealerCars.forEach(dc => {
            if (!cars.find(c => c.id === dc.id)) {
                cars.push(dc);
            }
        });

        playerData.skills = fallbackSkills;
        if (save.playerData.skills && typeof save.playerData.skills === 'object') {
            Object.keys(fallbackSkills).forEach(key => {
                const baseSkill = fallbackSkills[key];
                const loadedSkill = save.playerData.skills[key];
                if (!loadedSkill) return;
                const level = Number(loadedSkill.level);
                if (Number.isFinite(level)) {
                    baseSkill.level = Math.max(0, Math.min(baseSkill.max, Math.floor(level)));
                }
            });
        }

        cars.forEach(car => {
            car.upgrades = [];
            if (save.carsUpgrades && Array.isArray(save.carsUpgrades[car.id])) {
                car.upgrades = [...save.carsUpgrades[car.id]];
            }
        });

        // Sync upgrades back to stored dealerCars as well
        playerData.dealerCars.forEach(dc => {
            if (save.carsUpgrades && Array.isArray(save.carsUpgrades[dc.id])) {
                dc.upgrades = [...save.carsUpgrades[dc.id]];
            }
        });

        if (save.selectedCarId) {
            const restoredCar = cars.find(c => c.id === save.selectedCarId);
            if (restoredCar && playerData.ownedCars.includes(restoredCar.id)) {
                selectedPlayerCar = restoredCar;
            }
        }

        return true;
    } catch (error) {
        console.warn('Could not load game state:', error);
        return false;
    }
}

function initializePersistentState() {
    const loaded = loadGameState();

    if (!loaded) {
        askPlayerName(playerData.name || 'Driver').then(name => {
            playerData.name = name;
            saveGameState();
            completeInitialization();
        });
    } else if (!playerData.name || !playerData.name.trim()) {
        askPlayerName('Driver').then(name => {
            playerData.name = name;
            saveGameState();
            completeInitialization();
        });
    } else {
        completeInitialization();
    }
}
