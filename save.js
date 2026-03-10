const SAVE_KEY = 'projectRedlineSaveV1';

function cloneSkillsTemplate() {
    return JSON.parse(JSON.stringify(playerData.skills));
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
        version: 1,
        savedAt: Date.now(),
        playerData: {
            name: sanitizePlayerName(playerData.name),
            money: Number(playerData.money) || 0,
            ownedCars: Array.isArray(playerData.ownedCars) ? [...playerData.ownedCars] : [],
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
