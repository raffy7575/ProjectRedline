function startSimulation() {
    if (!selectedPlayerCar) {
        alert('Select a car first!');
        return;
    }

    generateTrackPath();
    buildRaceState();
    globalRaceTime = 0;
    lastTime = 0;

    document.getElementById('selection-panel').style.display = 'none';
    document.getElementById('race-layout').style.display = 'grid';
    document.getElementById('race-header-text').innerText = `${currentTrack.name} - ${currentTrack.laps} laps - Race started`;

    animationId = requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime) {
    if (!lastTime) {
        lastTime = currentTime;
        if (!isFastForwardingNow) {
            animationId = requestAnimationFrame(gameLoop);
        }
        return;
    }

    let rawDt = (currentTime - lastTime) / 1000;

    if (!isSkippingSimulation && (rawDt < 0 || rawDt > MAX_FRAME_DT)) {
        lastTime = currentTime;
        animationId = requestAnimationFrame(gameLoop);
        return;
    }

    let dt = (rawDt * TIME_MULTIPLIER) * (isSkippingSimulation ? SKIP_SIM_SPEED : 1.0);
    lastTime = currentTime;
    globalRaceTime += dt;

    const canvas = document.getElementById('race-track');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const shouldRender = !isSkippingSimulation;
    if (trackPath.length < 2) return;

    if (shouldRender) {
        renderTrack(ctx);
    }

    const draftWindow = 40;
    let allFinished = true;

    raceState.forEach(state => {
        if (!state.finished) {
            allFinished = false;
            updateVehicleState(state, dt, draftWindow);
        }
    });

    let sortedRacers = [...raceState].sort((a, b) => b.totalProgress - a.totalProgress);
    updateLiveUI(sortedRacers);
    if (shouldRender) renderCars(ctx);

    if (!allFinished) {
        let finishedCount = raceState.filter(s => s.finished).length;
        let totalCars = raceState.length;

        if (finishedCount >= totalCars - 1) {
            raceState.forEach(state => {
                if (!state.finished) {
                    state.finished = true;
                    state.finalTotalTime = globalRaceTime;
                }
            });
            allFinished = true;
        }
    }

    if (!allFinished) {
        if (!isFastForwardingNow) {
            animationId = requestAnimationFrame(gameLoop);
        }
    } else {
        endRace(sortedRacers);
    }
}

function endRace(sortedRacers) {
    isSkippingSimulation = false;
    isFastForwardingNow = false;
    document.getElementById('race-layout').style.display = 'none';

    sortedRacers.sort((a, b) => a.finalTotalTime - b.finalTotalTime);

    let playerPos = sortedRacers.findIndex(s => s.isPlayer) + 1;
    let prize = 0;
    if (playerPos === 1) prize = 2000;
    else if (playerPos === 2) prize = 1000;
    else if (playerPos === 3) prize = 500;
    else prize = 100;

    playerData.money += prize;
    saveGameState();

    document.getElementById('earnings-text').innerText = `$${prize} (Finished ${playerPos}º)`;
    document.getElementById('results-panel').style.display = 'block';
}

function skipSimulation() {
    if (!isSkippingSimulation) {
        isSkippingSimulation = true;
        isFastForwardingNow = true;
        let simTime = lastTime || performance.now();
        const simStepMs = 16.6667;
        const maxIterations = 12000;

        for (let i = 0; i < maxIterations; i++) {
            if (!raceState.length || raceState.every(s => s.finished)) break;
            simTime += simStepMs;
            gameLoop(simTime);
        }

        isFastForwardingNow = false;

        if (raceState.length && !raceState.every(s => s.finished)) {
            animationId = requestAnimationFrame(gameLoop);
        }
    }
}

function showResetModal() {
    document.getElementById('reset-modal-overlay').style.display = 'flex';
}

function cancelReset() {
    document.getElementById('reset-modal-overlay').style.display = 'none';
}

function confirmReset() {
    localStorage.removeItem('projectRedlineSaveV1');

    playerData = {
        name: 'Driver',
        money: 10000,
        ownedCars: [],
        skills: cloneSkillsTemplate()
    };

    selectedPlayerCar = null;
    raceState = [];
    globalRaceTime = 0;
    lastTime = 0;
    isSkippingSimulation = false;

    document.getElementById('reset-modal-overlay').style.display = 'none';

    askPlayerName('Driver').then(name => {
        playerData.name = name;
        saveGameState();
        completeInitialization();
    });
}

function resetGame() {
    document.getElementById('results-panel').style.display = 'none';
    document.getElementById('selection-panel').style.display = 'block';
    isSkippingSimulation = false;

    rollRandomTrack();

    document.querySelectorAll('.tab-btn')[0].click();
    updateHUD();
    saveGameState();
}
