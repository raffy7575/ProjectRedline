function createRaceEntry(car, isPlayer, trackTarmac, trackDirt) {
    let activeStats = getCarStats(car);

    if (isPlayer) {
        let shiftBonus = 1 + (playerData.skills.shifting.level * 0.02);
        let cornerBonus = 1 + (playerData.skills.cornering.level * 0.02);
        let brakeBonus = 1 + (playerData.skills.braking.level * 0.02);

        activeStats.acceleration *= shiftBonus;
        activeStats.handling *= cornerBonus;
        activeStats.braking *= brakeBonus;
    }

    let tarmacEff = activeStats.tarmac / 100;
    let dirtEff = activeStats.dirt / 100;
    let terrainPenalty = (trackTarmac * (1 - tarmacEff)) + (trackDirt * (1 - dirtEff));

    return {
        car: car,
        isPlayer: isPlayer,
        stats: activeStats,
        terrainPenalty: Math.max(0, Math.min(0.95, terrainPenalty || 0)),
        driverPace: 0.95 + Math.random() * 0.1,
        progressIdx: 0,
        lap: 1,
        speed: 0.1,
        rpm: 900,
        totalProgress: 0,
        currentGear: 0,
        throttle: 0,
        brake: 0,
        shiftCooldown: 0,
        isDownshifting: false,
        prevSpeedMs: 0,
        slipAngleDeg: 0,
        wheelLock: 0,
        shiftTimeRequired: 0.15 + ((100 - activeStats.acceleration) * 0.0015),
        currentLapTime: 0,
        lastLapTime: 0,
        finalTotalTime: 0,
        finished: false
    };
}

function buildRaceState() {
    raceState = [];
    let trackTarmac = currentTrack.tarmac !== undefined ? currentTrack.tarmac : 1;
    let trackDirt = currentTrack.dirt !== undefined ? currentTrack.dirt : 0;

    cars.forEach(car => {
        let isPlayer = car.id === selectedPlayerCar.id;
        raceState.push(createRaceEntry(car, isPlayer, trackTarmac, trackDirt));
    });
}

function generateTrackPath() {
    trackPath = [];
    const pts = currentTrack.waypoints;
    const numPts = pts.length;
    const segments = 100;

    for (let i = 0; i < numPts; i++) {
        let p0 = pts[(i - 1 + numPts) % numPts];
        let p1 = pts[i];
        let p2 = pts[(i + 1) % numPts];
        let p3 = pts[(i + 2) % numPts];

        for (let t = 0; t < 1; t += 1 / segments) {
            let t2 = t * t;
            let t3 = t2 * t;
            let x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
            let y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
            trackPath.push({ x: 40 + x * (CANVAS_W - 80), y: 40 + y * (CANVAS_H - 80), curvature: 0 });
        }
    }

    for (let i = 0; i < trackPath.length; i++) {
        let prev = trackPath[(i - 5 + trackPath.length) % trackPath.length];
        let curr = trackPath[i];
        let next = trackPath[(i + 5) % trackPath.length];

        let dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
        let dx2 = next.x - curr.x, dy2 = next.y - curr.y;

        let angle = Math.abs(Math.atan2(dy2, dx2) - Math.atan2(dy1, dx1));
        if (angle > Math.PI) angle = 2 * Math.PI - angle;
        trackPath[i].curvature = Math.min(1, angle / (Math.PI / 2));
    }
}

function getGapToNextCarAhead(currentState) {
    let minGap = Infinity;
    raceState.forEach(other => {
        if (other === currentState || other.finished) return;
        let gap = other.totalProgress - currentState.totalProgress;
        if (gap > 0 && gap < minGap) minGap = gap;
    });
    return minGap;
}

function buildPhysicsContext(state, dt) {
    const INTERNAL_TO_MS = PROGRESS_SCALE * METERS_PER_PROGRESS_STEP;
    const REDLINE = state.car.redline || 8000;
    const gearRatios = state.car.gearRatios || [1.0];
    const wheelRadius = Math.max(0.2, state.car.wheelRadius || 0.32);

    let terrainMult = Math.pow(1 - state.terrainPenalty, 1.4);
    terrainMult = Math.max(0.15, terrainMult);

    if (typeof state.currentGear !== 'number') state.currentGear = 0;
    state.currentGear = Math.max(0, Math.min(state.currentGear, gearRatios.length - 1));

    let accelStatNorm = Math.max(0.4, Math.min(1.3, state.stats.acceleration / 100));
    let powerToWeight = Math.max(0.12, state.car.hp / Math.max(700, state.car.weight));

    let speedMs = state.speed * INTERNAL_TO_MS;
    if (typeof state.prevSpeedMs !== 'number') state.prevSpeedMs = speedMs;
    let longitudinalAccelMs2 = (speedMs - state.prevSpeedMs) / Math.max(0.001, dt);
    state.prevSpeedMs = speedMs;

    let brakeGs = 0.5 + ((state.stats.braking / 100) * 1.4);
    let brakeDecelMs2 = brakeGs * 9.81;
    let brakeDecelInternal = brakeDecelMs2 / INTERNAL_TO_MS;

    let handlingFactor = state.stats.handling / 100;
    let baseGrip = 0.65 + (handlingFactor * 1.45);
    let weightTransfer = Math.max(-0.18, Math.min(0.18, (-longitudinalAccelMs2 / 9.81) * 0.14));
    let frontLoadBias = 0.5 + weightTransfer;

    // Use aerodynamics module
    let aeroContext = calculateAerodynamicContext(state, state.car, { speedMs });
    let actualGrip = getLoadSensitiveGrip(baseGrip, aeroContext.aeroLoadFactor, terrainMult);

    let cdA = Math.max(0.2, state.car.dragCoeff * 2.1);
    let maxPossibleSpeed = calculateMaxSpeedFromPower(state.car, state.stats, terrainMult) * state.driverPace;

    return {
        INTERNAL_TO_MS,
        REDLINE,
        gearRatios,
        wheelRadius,
        terrainMult,
        accelStatNorm,
        powerToWeight,
        speedMs,
        brakeDecelMs2,
        brakeDecelInternal,
        frontLoadBias,
        actualGrip,
        cdA,
        maxPossibleSpeed
    };
}



function computeTargetSpeedData(state, physics, draftWindow) {
    let visionDistanceMeters = (physics.speedMs * 1.5) + ((physics.speedMs * Math.max(1, physics.speedMs)) / (2 * Math.max(1, physics.brakeDecelMs2)));
    let lookAheadPoints = Math.floor((visionDistanceMeters / METERS_PER_PROGRESS_STEP) * PROGRESS_SCALE);
    lookAheadPoints = Math.max(40, Math.min(Math.floor(trackPath.length * 0.75), lookAheadPoints));

    let targetSpeed = physics.maxPossibleSpeed;
    let maxCurveAhead = 0;

    for (let i = 2; i <= lookAheadPoints; i += 4) {
        let idx = Math.floor(state.progressIdx + i);
        idx = ((idx % trackPath.length) + trackPath.length) % trackPath.length;
        let c = trackPath[idx].curvature;

        if (c > maxCurveAhead) maxCurveAhead = c;

        if (c > 0.08) {
            let curveRadius = 35 / c;
            let trailBrakeGripBoost = 1 + Math.max(0, physics.frontLoadBias - 0.5) * Math.min(1, state.brake) * 0.22;
            let curveMaxSpeedMs = Math.sqrt(Math.max(0.01, (physics.actualGrip * trailBrakeGripBoost) * 9.81 * curveRadius));
            let curveMaxSpeedInternal = curveMaxSpeedMs / physics.INTERNAL_TO_MS;
            let distInternal = Math.max(0, i / PROGRESS_SCALE);
            let safeSpeedSq = (curveMaxSpeedInternal * curveMaxSpeedInternal) + (2 * physics.brakeDecelInternal * distInternal * 0.90);
            let safeSpeed = Math.sqrt(safeSpeedSq);

            if (safeSpeed < targetSpeed) {
                targetSpeed = safeSpeed;
            }
        }
    }

    let gapAhead = getGapToNextCarAhead(state);
    if (gapAhead < draftWindow) {
        let draftBonus = 0.08 * (1 - (gapAhead / draftWindow));
        targetSpeed *= (1 + draftBonus);
    }

    return { targetSpeed, maxCurveAhead };
}

function applyDriverInputsAndSlip(state, dt, physics, targetData) {
    let speedError = targetData.targetSpeed - state.speed;
    let desiredThrottle = 0;
    let desiredBrake = 0;

    if (speedError > 0.5) {
        desiredThrottle = 1.0;
    } else if (speedError > 0) {
        desiredThrottle = Math.max(0.1, speedError / 0.5);
        if (state.speed < 1.0) desiredThrottle = 1.0;
    } else if (speedError < -0.5) {
        desiredBrake = 1.0;
    } else {
        desiredBrake = (-speedError) / 0.5;
    }

    let currIdx = ((Math.floor(state.progressIdx) % trackPath.length) + trackPath.length) % trackPath.length;
    let currCurvature = trackPath[currIdx]?.curvature || 0;

    // Use tire physics module
    let slipData = calculateSlipAndGrip(state, physics, currCurvature);
    let tireData = detectSlidingAndLocking(state, physics, slipData, currCurvature);

    let isSliding = tireData.isSliding;
    if (isSliding) {
        let slideSeverity = Math.min(1, (slipData.slipNorm > 0 ? (slipData.slipNorm - 1.04) / 0.25 : 0));
        desiredThrottle *= (1 - 0.85 * slideSeverity);
        desiredBrake = Math.max(desiredBrake, 0.45 + 0.45 * slideSeverity);
        state.speed -= (physics.brakeDecelInternal * (0.20 + 0.45 * slideSeverity)) * dt;
    }

    let pedalDt = dt * (isSliding ? 15.0 : 6.0);
    state.throttle += (desiredThrottle - state.throttle) * Math.min(1, pedalDt);
    state.brake += (desiredBrake - state.brake) * Math.min(1, pedalDt * 1.5);

    state.wheelLock = tireData.wheelLock;
    if (state.wheelLock > 0) {
        state.brake *= (1 - state.wheelLock * 0.45);
        if (currCurvature > 0.1) {
            desiredThrottle *= (1 - state.wheelLock * 0.35);
            state.speed -= (physics.brakeDecelInternal * 0.10 * state.wheelLock) * dt;
        }
    }
}

function updateGearboxAndPreForceRpm(state, dt, physics, maxCurveAhead) {
    let currentGearRatio = getEffectiveGearRatio(physics, state.currentGear);
    let wheelRpmReal = (physics.speedMs / (2 * Math.PI * physics.wheelRadius)) * 60;

    if (typeof state.shiftCooldown !== 'number') state.shiftCooldown = 0;
    state.shiftCooldown = Math.max(0, state.shiftCooldown - dt);

    let upshiftThreshold = getUpshiftThreshold(physics, maxCurveAhead);

    if (state.shiftCooldown <= 0) {
        state.isDownshifting = false;

        if (shouldUpshift(state, physics, upshiftThreshold)) {
            state.currentGear++;
            state.shiftCooldown = getShiftTimeForState(state, physics, state.currentGear, false);
            currentGearRatio = getEffectiveGearRatio(physics, state.currentGear);
        } else if (shouldDownshiftCorner(state, physics, wheelRpmReal, currentGearRatio, maxCurveAhead)) {
            state.currentGear--;
            state.shiftCooldown = getShiftTimeForState(state, physics, state.currentGear, true);
            state.isDownshifting = true;
            currentGearRatio = getEffectiveGearRatio(physics, state.currentGear);
        } else if (shouldDownshiftAccel(state, physics, wheelRpmReal, currentGearRatio)) {
            state.currentGear--;
            state.shiftCooldown = getShiftTimeForState(state, physics, state.currentGear, true);
            state.isDownshifting = true;
            currentGearRatio = getEffectiveGearRatio(physics, state.currentGear);
        }
    }

    let isHittingRevLimiter = false;
    let mechanicalEngineRpm = calculateMechanicalEngineRpm(physics.speedMs, currentGearRatio, physics.wheelRadius);
    let isClutchSlipping = (state.currentGear === 0 && mechanicalEngineRpm < 1500);

    if (state.shiftCooldown > 0) {
        let targetRevMatch = wheelRpmReal * currentGearRatio * FINAL_DRIVE_RATIO;
        updateRpmDuringShift(state, dt, targetRevMatch, state.isDownshifting);
    } else if (isClutchSlipping) {
        handleClutchSlipping(state, dt, 900 + (state.throttle * 4000));
    } else {
        syncRpmToWheels(state, physics, mechanicalEngineRpm);
        isHittingRevLimiter = handleRevLimiter(state, physics);
    }

    state.rpm = Math.max(900, Math.min(physics.REDLINE, state.rpm));

    return { currentGearRatio, isHittingRevLimiter };
}



function syncPostForceRpm(state, dt, physics, drivetrainData) {
    let postSpeedMs = state.speed * physics.INTERNAL_TO_MS;
    let postWheelRpmReal = (postSpeedMs / (2 * Math.PI * physics.wheelRadius)) * 60;
    let postMechanicalEngineRpm = calculateMechanicalEngineRpm(postSpeedMs, drivetrainData.currentGearRatio, physics.wheelRadius);

    if (state.shiftCooldown > 0) {
        let targetRevMatch = postWheelRpmReal * drivetrainData.currentGearRatio * FINAL_DRIVE_RATIO;
        updateRpmDuringShift(state, dt, targetRevMatch, state.isDownshifting);
    } else if (state.currentGear === 0 && postMechanicalEngineRpm < 1500) {
        handleClutchSlipping(state, dt, 900 + (state.throttle * 4000));
    } else {
        syncRpmToWheels(state, physics, postMechanicalEngineRpm);
        if (state.rpm >= physics.REDLINE) {
            state.rpm = physics.REDLINE - (Math.random() * 300 + 50);
        }
    }

    state.rpm = Math.max(900, Math.min(physics.REDLINE, state.rpm));
}

function updateProgressAndLap(state, dt) {
    if (typeof state.visualSpeed !== 'number') state.visualSpeed = state.speed;
    let speedDelta = state.speed - state.visualSpeed;
    let speedBlend = Math.min(1, dt * (Math.abs(speedDelta) > 0.6 ? 24 : 16));
    state.visualSpeed += speedDelta * speedBlend;
    if (Math.abs(speedDelta) < 0.03 || Math.abs(speedDelta) > 1.2) {
        state.visualSpeed = state.speed;
    }
    state.visualSpeed = Math.max(0, state.visualSpeed);

    let stepsToMove = state.visualSpeed * dt * PROGRESS_SCALE;
    state.progressIdx += stepsToMove;
    state.totalProgress += stepsToMove;

    if (state.progressIdx >= trackPath.length) {
        state.progressIdx = state.progressIdx % trackPath.length;
        state.lap++;
        state.lastLapTime = state.currentLapTime;
        state.currentLapTime = 0;

        if (state.lap > currentTrack.laps) {
            state.lap = currentTrack.laps;
            state.finished = true;
            state.finalTotalTime = globalRaceTime;
        }
    }
}

function updateVehicleState(state, dt, draftWindow) {
    if (state.finished) return;

    state.currentLapTime += dt;

    let physics = buildPhysicsContext(state, dt);
    let targetData = computeTargetSpeedData(state, physics, draftWindow);
    applyDriverInputsAndSlip(state, dt, physics, targetData);

    let drivetrainData = updateGearboxAndPreForceRpm(state, dt, physics, targetData.maxCurveAhead);
    applyLongitudinalForces(state, dt, physics, drivetrainData);
    syncPostForceRpm(state, dt, physics, drivetrainData);
    updateProgressAndLap(state, dt);
}
