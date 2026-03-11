/* =============================================================================
     js/race.js  —  Race flow controller (start → simulate → finish → rewards)

     WHAT THIS FILE DOES
     - Starts a race from a selected career event
     - Runs the frame-by-frame simulation loop
     - Updates race UI (overlay, header, standings, telemetry)
     - Ends race, calculates payout/progression/wear
     - Handles skip simulation and hard reset modal actions

     HOW TO SAFELY EDIT
     - UI text: edit string literals in `updateRaceStartOverlay()`, `startSimulation()`,
         and `endRace()`.
     - Countdown timing: `raceCountdownDurationMs`, `raceGreenHoldMs`, and thresholds
         inside `gameLoop()`.
     - Prize distribution: position multipliers inside `endRace()`.

     CAUTION
     - Load order matters because this file uses globals from other files.
     - If changing function names, also update any `onclick="..."` usage in HTML.
     ============================================================================= */

let isRaceCountdownActive = false;
let raceCountdownStartTime = 0;
let raceCountdownDurationMs = 3200;
let raceGreenHoldMs = 700;

// Controls the red/yellow/green start-light overlay.
// `phase` should be: 'red' | 'yellow' | 'green'.
function updateRaceStartOverlay(phase, text) {
    let overlay = document.getElementById('race-start-overlay');
    let label = document.getElementById('race-start-text');
    let red = document.getElementById('start-light-red');
    let yellow = document.getElementById('start-light-yellow');
    let green = document.getElementById('start-light-green');

    if (!overlay || !label || !red || !yellow || !green) return;

    overlay.classList.remove('hidden');
    label.innerText = text;
    red.classList.remove('active');
    yellow.classList.remove('active');
    green.classList.remove('active');

    if (phase === 'red') red.classList.add('active');
    if (phase === 'yellow') yellow.classList.add('active');
    if (phase === 'green') green.classList.add('active');
}

function hideRaceStartOverlay() {
    let overlay = document.getElementById('race-start-overlay');
    if (overlay) overlay.classList.add('hidden');
}

// Applies post-race car wear (engine/tires/suspension) if maintenance is unlocked.
// Returns wear details + full service cost for result UI.
function applyWearAndTearFromRace(playerRaceState) {
    // Feature gate: wear is locked until Class B (tier 3)
    if (typeof isFeatureUnlocked === 'function' && !isFeatureUnlocked('maintenance')) return null;

    if (!selectedPlayerCar || !playerRaceState) return null;

    let carId = selectedPlayerCar.id;
    let condition = getCarCondition(carId);
    let tarmac = currentTrack?.tarmac || 0;
    let dirt = currentTrack?.dirt || 0;
    let laps = currentTrack?.laps || 1;

    let distanceFactor = 0.8 + (laps * 0.22);
    let engineWear = distanceFactor * (0.9 + tarmac * 0.6 + dirt * 0.2);
    let tiresWear = distanceFactor * (1.0 + tarmac * 0.35 + dirt * 0.95);
    let suspensionWear = distanceFactor * (0.8 + tarmac * 0.25 + dirt * 0.75);

    let wear = {
        engine: Math.max(0.6, engineWear),
        tires: Math.max(0.8, tiresWear),
        suspension: Math.max(0.6, suspensionWear)
    };

    condition.engine = Math.max(0, condition.engine - wear.engine);
    condition.tires = Math.max(0, condition.tires - wear.tires);
    condition.suspension = Math.max(0, condition.suspension - wear.suspension);

    return {
        wear,
        condition: {
            engine: condition.engine,
            tires: condition.tires,
            suspension: condition.suspension
        },
        fullServiceCost: getTotalServiceCost(carId)
    };
}

function startSimulation(eventId) {
    if (!selectedPlayerCar || !selectedPlayerCar.id) {
        alert('❌ Select a car first! Click on a car in your garage to select it.');
        console.error('startSimulation: No player car selected. selectedPlayerCar =', selectedPlayerCar);
        return;
    }

    let context = getCareerEventContext(eventId);
    if (!context || !context.event) {
        alert('Could not load this event.');
        return;
    }

    let event = context.event;
    if (!isEventUnlocked(context.league, context.eventIndex)) {
        alert('This event is locked. Complete previous events first.');
        return;
    }

    let validation = validateCarForEvent(selectedPlayerCar, event);
    if (!validation.isEligible) {
        alert('Selected car failed Tech Inspection for this event.');
        return;
    }

    let track = getEventTrack(event);
    if (!track) {
        alert('Track data for this event is unavailable.');
        return;
    }

    currentRaceEvent = event;
    currentTrack = track;

    // Reset any previous animation frame before starting a new race.
    cancelAnimationFrame(animationId);
    isRaceActive = true;
    generateTrackPath();
    buildRaceState();
    globalRaceTime = 0;
    lastTime = 0;
    isRaceCountdownActive = true;
    raceCountdownStartTime = 0;

    document.getElementById('selection-panel').style.display = 'none';
    document.getElementById('race-layout').style.display = 'grid';
    document.getElementById('race-header-text').innerText = `${event.name} - ${currentTrack.name} - ${currentTrack.laps} laps - On the grid`;
    updateRaceStartOverlay('red', 'RED LIGHTS');

    // Enter main simulation loop.
    animationId = requestAnimationFrame(gameLoop);
}

// Main race loop. Runs every frame (or simulated frame during skip mode).
function gameLoop(currentTime) {
    const canvas = document.getElementById('race-track');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (trackPath.length < 2) return;

    renderTrack(ctx);
    renderCars(ctx);

    // 3-stage pre-race countdown: red → yellow → green.
    if (isRaceCountdownActive) {
        if (!raceCountdownStartTime) raceCountdownStartTime = currentTime;

        let elapsed = currentTime - raceCountdownStartTime;
        if (elapsed < 2000) {
            updateRaceStartOverlay('red', 'RED LIGHTS');
            document.getElementById('race-header-text').innerText = `${currentTrack.name} - ${currentTrack.laps} laps - Hold position`;
        } else if (elapsed < 3200) {
            updateRaceStartOverlay('yellow', 'READY');
            document.getElementById('race-header-text').innerText = `${currentTrack.name} - ${currentTrack.laps} laps - Engines up`;
        } else if (elapsed < 3200 + raceGreenHoldMs) {
            updateRaceStartOverlay('green', 'GO GO GO');
            document.getElementById('race-header-text').innerText = `${currentTrack.name} - ${currentTrack.laps} laps - Race started`;
            lastTime = currentTime;
        } else {
            hideRaceStartOverlay();
            isRaceCountdownActive = false;
            lastTime = currentTime;
        }

        if (!isFastForwardingNow) {
            animationId = requestAnimationFrame(gameLoop);
        }
        return;
    }

    if (!lastTime) {
        lastTime = currentTime;
        if (!isFastForwardingNow) {
            animationId = requestAnimationFrame(gameLoop);
        }
        return;
    }

    // Delta-time in seconds between frames.
    let rawDt = (currentTime - lastTime) / 1000;

    if (!isSkippingSimulation && (rawDt < 0 || rawDt > MAX_FRAME_DT)) {
        lastTime = currentTime;
        animationId = requestAnimationFrame(gameLoop);
        return;
    }

    let dt = (rawDt * TIME_MULTIPLIER) * (isSkippingSimulation ? SKIP_SIM_SPEED : 1.0);
    lastTime = currentTime;
    globalRaceTime += dt;

    // In skip mode we still simulate physics, but avoid expensive rendering.
    const shouldRender = !isSkippingSimulation;

    if (shouldRender) {
        renderTrack(ctx);
    }

    const draftWindow = 40;
    let allFinished = true;

    raceState.forEach(state => {
        if (!state || state.finished) return;
        allFinished = false;
        try {
            updateVehicleState(state, dt, draftWindow);
        } catch (error) {
            state.finished = true;
            state.finalTotalTime = Number.MAX_SAFE_INTEGER;
            console.error('Race simulation error for entry:', state?.car?.id || 'unknown-car', error);
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
    if (!isRaceActive) return;
    isRaceActive = false;
    isSkippingSimulation = false;
    isFastForwardingNow = false;
    document.getElementById('race-layout').style.display = 'none';

    sortedRacers.sort((a, b) => a.finalTotalTime - b.finalTotalTime);

    // Prize table by finishing position.
    let playerPos = sortedRacers.findIndex(s => s.isPlayer) + 1;
    let basePrize = currentRaceEvent?.prize || 1000;
    let prize = 0;
    if (playerPos === 1) prize = basePrize;
    else if (playerPos === 2) prize = Math.round(basePrize * 0.55);
    else if (playerPos === 3) prize = Math.round(basePrize * 0.30);
    else prize = Math.round(basePrize * 0.12);

    let playerRaceState = sortedRacers.find(s => s.isPlayer);
    let wearResult = applyWearAndTearFromRace(playerRaceState);

    let progressResult = null;
    let aiUpgradeFeed = [];
    if (currentRaceEvent?.id) {
        progressResult = recordCareerRaceResult(currentRaceEvent.id, playerPos, sortedRacers);
        let aiCtx = getCareerEventContext(currentRaceEvent.id);
        if (aiCtx?.league?.id) {
            aiUpgradeFeed = advanceAiAfterEvent(aiCtx.league.id, currentRaceEvent.id) || [];
        }
    }

    // Apply reward and persist progress.
    playerData.money += prize;
    saveGameState();

    buildGarage();
    buildMaintenancePanel();
    if (selectedPlayerCar) selectCar(selectedPlayerCar);

    let wearLine = '';
    let serviceLine = '';
    let careerLine = '';
    let pointsLine = '';
    if (wearResult) {
        wearLine = `<br><span style="color:#ffb74d; font-size:0.84em;">Wear: Engine -${wearResult.wear.engine.toFixed(1)}% · Tires -${wearResult.wear.tires.toFixed(1)}% · Suspension -${wearResult.wear.suspension.toFixed(1)}%</span>`;
        serviceLine = `<br><span style="color:#90caf9; font-size:0.80em;">Full service available in garage: $${wearResult.fullServiceCost.toLocaleString()}</span>`;
    }
    if (progressResult) {
        let required = formatPositionLabel(progressResult.requiredPosition);
        let targetState = progressResult.targetMet ? 'Target Met' : 'Target Not Met';
        let targetColor = progressResult.targetMet ? '#8BC34A' : '#FF8A80';
        careerLine = `<br><span style="color:${targetColor}; font-size:0.82em;">${targetState} · Required ${required}</span>`;
        pointsLine = `<br><span style="color:#03A9F4; font-size:0.82em;">Championship Points: +${progressResult.pointsAwarded || 0}</span>`;
    }
    if (progressResult?.unlockedLeagueId) {
        let unlocked = leagues.find(league => league.id === progressResult.unlockedLeagueId);
        if (unlocked) {
            careerLine += `<br><span style="color:#8BC34A; font-size:0.82em;">League Unlocked: ${unlocked.name}</span>`;
        }
    } else if (progressResult?.eventCompleted) {
        careerLine += '<br><span style="color:#8BC34A; font-size:0.82em;">Event marked as completed in Career Mode.</span>';
    }

    let eventLine = currentRaceEvent ? `<br><span style="color:#bdbdbd; font-size:0.80em;">${currentRaceEvent.name}</span>` : '';
    let aiUpgradeLine = '';
    if (aiUpgradeFeed.length > 0) {
        let names = aiUpgradeFeed.map(e => (e.rivalName || '').split(' ')[0]).filter(Boolean);
        aiUpgradeLine = `<br><span style="color:#ff9800; font-size:0.78em;">&#128270; Rivals upgraded: ${names.join(', ')} &mdash; check Rival Intel</span>`;
    }
    // Results block supports rich status lines (career target, wear, AI upgrades).
    document.getElementById('earnings-text').innerHTML = `$${prize} (Finished ${playerPos}º)${eventLine}${pointsLine}${careerLine}${wearLine}${serviceLine}${aiUpgradeLine}`;
    document.getElementById('results-panel').style.display = 'block';
}

// Fast-forwards simulation to race end (physics kept, drawing minimized).
function skipSimulation() {
    if (isRaceCountdownActive) return;
    if (!isSkippingSimulation) {
        cancelAnimationFrame(animationId);
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
    cancelAnimationFrame(animationId);
    isRaceActive = false;
    localStorage.removeItem('projectRedlineSaveV1');

    // Hard reset: rebuild player profile to default starter state.
    playerData = {
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
        skills: cloneSkillsTemplate()
    };

    // Remove any previously purchased dealer cars from the global cars array
    for (let i = cars.length - 1; i >= 0; i--) {
        if (cars[i].isDealer) cars.splice(i, 1);
    }
    // Clear all installed upgrades from remaining starter cars
    cars.forEach(car => {
        car.upgrades = [];
    });
    if (typeof invalidateDealerCache === 'function') invalidateDealerCache();

    selectedPlayerCar = null;
    currentRaceEvent = null;
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
    // Soft reset after a finished race: return to event selection screen.
    document.getElementById('results-panel').style.display = 'none';
    document.getElementById('selection-panel').style.display = 'block';
    currentRaceEvent = null;
    isSkippingSimulation = false;
    isRaceCountdownActive = false;
    hideRaceStartOverlay();
    renderCareerMode();

    document.querySelectorAll('.tab-btn')[0].click();
    updateHUD();
    saveGameState();
}
