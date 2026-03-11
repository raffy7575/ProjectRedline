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
let raceHiddenAtMs = null;

function setCustomTrackPath() {
    const sourceW = 2752;
    const sourceH = 1536;
    const scaleX = CANVAS_W / sourceW;
    const scaleY = CANVAS_H / sourceH;

    const sourceTrackPath = [
        { x: 712, y: 428 }, { x: 793, y: 224 }, { x: 987, y: 350 }, { x: 1130, y: 352 },
        { x: 1126, y: 491 }, { x: 1150, y: 588 }, { x: 1174, y: 751 }, { x: 1194, y: 787 },
        { x: 1233, y: 807 }, { x: 1485, y: 885 }, { x: 1653, y: 989 }, { x: 1673, y: 1018 },
        { x: 1685, y: 1060 }, { x: 1694, y: 1116 }, { x: 1690, y: 1164 }, { x: 1675, y: 1186 },
        { x: 1631, y: 1198 }, { x: 1575, y: 1220 }, { x: 1539, y: 1237 }, { x: 1500, y: 1269 },
        { x: 1476, y: 1300 }, { x: 1451, y: 1334 }, { x: 1043, y: 1118 }, { x: 955, y: 1077 },
        { x: 882, y: 1045 }, { x: 827, y: 1033 }, { x: 773, y: 1038 }, { x: 717, y: 1038 },
        { x: 676, y: 1040 }, { x: 639, y: 1030 }, { x: 608, y: 1006 }, { x: 581, y: 970 },
        { x: 554, y: 928 }, { x: 532, y: 882 }, { x: 525, y: 834 }, { x: 571, y: 736 },
        { x: 664, y: 569 }, { x: 700, y: 462 }
    ];

    const controlPoints = sourceTrackPath.map(point => ({
        x: point.x * scaleX,
        y: point.y * scaleY,
        curvature: 0
    }));

    // First pass: smooth Catmull-Rom spline through control points.
    const segmentsPerControlPoint = 28;
    const numPts = controlPoints.length;
    const densePath = [];

    for (let i = 0; i < numPts; i++) {
        let p0 = controlPoints[(i - 1 + numPts) % numPts];
        let p1 = controlPoints[i];
        let p2 = controlPoints[(i + 1) % numPts];
        let p3 = controlPoints[(i + 2) % numPts];

        for (let s = 0; s < segmentsPerControlPoint; s++) {
            let t = s / segmentsPerControlPoint;
            let t2 = t * t;
            let t3 = t2 * t;

            let x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
            let y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

            densePath.push({ x, y, curvature: 0 });
        }
    }

    // Second pass: arc-length reparameterization so each index step represents
    // near-constant physical distance regardless of local curve shape.
    const targetStepPx = 4.5;
    const cumulative = [0];
    let totalLength = 0;

    for (let i = 0; i < densePath.length; i++) {
        let a = densePath[i];
        let b = densePath[(i + 1) % densePath.length];
        totalLength += Math.hypot(b.x - a.x, b.y - a.y);
        cumulative.push(totalLength);
    }

    let sampleCount = Math.max(densePath.length, Math.floor(totalLength / targetStepPx));
    trackPath = [];

    let segIdx = 0;
    for (let s = 0; s < sampleCount; s++) {
        let targetDist = (s / sampleCount) * totalLength;
        while (segIdx < densePath.length - 1 && cumulative[segIdx + 1] < targetDist) {
            segIdx++;
        }

        let a = densePath[segIdx % densePath.length];
        let b = densePath[(segIdx + 1) % densePath.length];
        let segStart = cumulative[segIdx];
        let segEnd = cumulative[segIdx + 1];
        let segLen = Math.max(0.0001, segEnd - segStart);
        let t = Math.max(0, Math.min(1, (targetDist - segStart) / segLen));

        trackPath.push({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            curvature: 0
        });
    }

    // Calibrate simulation distance scale against desired real lap distance.
    // lapMeters = (trackPath.length / PROGRESS_SCALE) * METERS_PER_PROGRESS_STEP
    let targetLapDistanceKm = Number.isFinite(currentTrack?.realLapDistanceKm) ? currentTrack.realLapDistanceKm : 1.8;
    let targetLapDistanceMeters = Math.max(0.3, targetLapDistanceKm) * 1000;
    let calibratedMetersPerStep = (targetLapDistanceMeters * PROGRESS_SCALE) / Math.max(1, trackPath.length);
    if (typeof setMetersPerProgressStep === 'function') {
        setMetersPerProgressStep(calibratedMetersPerStep);
    }

    // Keep per-point curvature for physics systems that depend on corner severity.
    const curvatureLook = Math.max(2, Math.floor(trackPath.length / 220));
    for (let i = 0; i < trackPath.length; i++) {
        let prev = trackPath[(i - curvatureLook + trackPath.length) % trackPath.length];
        let curr = trackPath[i];
        let next = trackPath[(i + curvatureLook) % trackPath.length];

        let dx1 = curr.x - prev.x;
        let dy1 = curr.y - prev.y;
        let dx2 = next.x - curr.x;
        let dy2 = next.y - curr.y;

        let angle = Math.abs(Math.atan2(dy2, dx2) - Math.atan2(dy1, dx1));
        if (angle > Math.PI) angle = 2 * Math.PI - angle;
        curr.curvature = Math.min(1, angle / (Math.PI / 2));
    }
}

function simulateHiddenRaceTime(hiddenElapsedMs) {
    if (!isRaceActive || isRaceCountdownActive || isSkippingSimulation || hiddenElapsedMs <= 0) return;
    if (!Array.isArray(raceState) || raceState.length === 0) return;

    const draftWindow = 40;
    const fixedStepSeconds = 1 / 30;
    const maxCatchupSteps = 12000;
    let remainingSeconds = hiddenElapsedMs / 1000;

    for (let step = 0; step < maxCatchupSteps && remainingSeconds > 0; step++) {
        if (raceState.every(state => !state || state.finished)) break;

        let frameSeconds = Math.min(fixedStepSeconds, remainingSeconds);
        let dt = frameSeconds * TIME_MULTIPLIER;
        remainingSeconds -= frameSeconds;
        globalRaceTime += dt;

        raceState.forEach(state => {
            if (!state || state.finished) return;
            try {
                updateVehicleState(state, dt, draftWindow);
            } catch (error) {
                state.finished = true;
                state.finalTotalTime = Number.MAX_SAFE_INTEGER;
                console.error('Race simulation error for entry:', state?.car?.id || 'unknown-car', error);
            }
        });

        let finishedCount = raceState.filter(s => s.finished).length;
        let totalCars = raceState.length;
        if (finishedCount >= totalCars - 1) {
            raceState.forEach(state => {
                if (!state.finished) {
                    state.finished = true;
                    state.finalTotalTime = globalRaceTime;
                }
            });
            break;
        }
    }

    let sortedRacers = [...raceState].sort((a, b) => b.totalProgress - a.totalProgress);
    updateLiveUI(sortedRacers);

    if (raceState.every(state => state?.finished)) {
        endRace(sortedRacers);
    }
}

function handleRaceVisibilityChange() {
    if (!isRaceActive || isSkippingSimulation) return;

    if (document.hidden) {
        raceHiddenAtMs = performance.now();
        return;
    }

    if (raceHiddenAtMs) {
        let hiddenElapsedMs = Math.max(0, performance.now() - raceHiddenAtMs);
        raceHiddenAtMs = null;
        simulateHiddenRaceTime(hiddenElapsedMs);
    }

    lastTime = performance.now();
}

document.addEventListener('visibilitychange', handleRaceVisibilityChange);

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
    setCustomTrackPath();
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
    raceHiddenAtMs = null;
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
