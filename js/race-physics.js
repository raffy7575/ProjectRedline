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

function updateVehicleState(state, dt, draftWindow) {
    if (state.finished) return;

    state.currentLapTime += dt;

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

    function getEffectiveGearRatio(gearIdx) {
        let base = gearRatios[Math.max(0, Math.min(gearIdx, gearRatios.length - 1))] || 1.0;
        let shortGearBoost = gearIdx <= 2 ? (1.03 + (accelStatNorm * 0.05) + (powerToWeight * 0.06)) : 1.0;
        let highGearTrim = gearIdx >= 3 ? 0.985 : 1.0;
        return base * shortGearBoost * highGearTrim;
    }

    function getShiftTime(targetGearIdx, isDownshift) {
        let statFactor = 1.0 - (accelStatNorm * 0.20) - (powerToWeight * 0.10);
        statFactor = Math.max(0.72, Math.min(1.05, statFactor));
        let earlyGearFactor = targetGearIdx <= 2 ? 0.72 : 1.0;
        let downshiftFactor = isDownshift ? 0.90 : 1.0;
        return Math.max(0.055, state.shiftTimeRequired * statFactor * earlyGearFactor * downshiftFactor);
    }

    let currentGearRatio = getEffectiveGearRatio(state.currentGear);
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

    const rhoAir = 1.225;
    let clA = Math.max(0.2, (state.car.downforceCoeff || 0.75) * (0.8 + handlingFactor * 0.6));
    let downforceN = 0.5 * rhoAir * clA * speedMs * speedMs;
    let staticLoadN = state.car.weight * 9.81;
    let aeroLoadFactor = Math.max(1.0, (staticLoadN + downforceN) / staticLoadN);

    let loadSensitiveGrip = baseGrip * (0.86 + 0.20 * Math.sqrt(aeroLoadFactor));
    let actualGrip = loadSensitiveGrip * terrainMult;

    let hpAjustado = state.car.hp * (0.5 + (state.stats.topSpeed / 200));
    let powerWatts = hpAjustado * 745.7;
    let cdA = Math.max(0.2, state.car.dragCoeff * 2.1);
    let vmaxMs = Math.pow(powerWatts / (0.5 * rhoAir * cdA), 1 / 3);
    let maxPossibleSpeed = (vmaxMs / INTERNAL_TO_MS) * terrainMult * state.driverPace;

    let visionDistanceMeters = (speedMs * 1.5) + ((speedMs * Math.max(1, speedMs)) / (2 * Math.max(1, brakeDecelMs2)));
    let lookAheadPoints = Math.floor((visionDistanceMeters / METERS_PER_PROGRESS_STEP) * PROGRESS_SCALE);
    lookAheadPoints = Math.max(40, Math.min(Math.floor(trackPath.length * 0.75), lookAheadPoints));

    let targetSpeed = maxPossibleSpeed;
    let maxCurveAhead = 0;

    for (let i = 2; i <= lookAheadPoints; i += 4) {
        let idx = Math.floor(state.progressIdx + i);
        idx = ((idx % trackPath.length) + trackPath.length) % trackPath.length;
        let c = trackPath[idx].curvature;

        if (c > maxCurveAhead) maxCurveAhead = c;

        if (c > 0.08) {
            let curveRadius = 35 / c;
            let trailBrakeGripBoost = 1 + Math.max(0, frontLoadBias - 0.5) * Math.min(1, state.brake) * 0.22;
            let curveMaxSpeedMs = Math.sqrt(Math.max(0.01, (actualGrip * trailBrakeGripBoost) * 9.81 * curveRadius));
            let curveMaxSpeedInternal = curveMaxSpeedMs / INTERNAL_TO_MS;
            let distInternal = Math.max(0, i / PROGRESS_SCALE);
            let safeSpeedSq = (curveMaxSpeedInternal * curveMaxSpeedInternal) + (2 * brakeDecelInternal * distInternal * 0.90);
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

    let speedError = targetSpeed - state.speed;
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

    let localRadiusMeters = 35 / Math.max(0.01, currCurvature);
    let localMaxCornerSpeedMsBase = Math.sqrt(Math.max(0.01, actualGrip * 9.81 * localRadiusMeters));
    let lateralAccelDemandMs2 = currCurvature > 0.01 ? ((speedMs * speedMs) / localRadiusMeters) : 0;
    let lateralGripCapacityMs2 = actualGrip * 9.81;
    let gripDemandRatio = lateralGripCapacityMs2 > 0 ? (lateralAccelDemandMs2 / lateralGripCapacityMs2) : 0;

    let slipNorm = Math.max(0, Math.min(2.0, (gripDemandRatio - 0.75) / 0.55));
    let B = 9.0, C = 1.35, E = 0.97;
    let bx = B * slipNorm;
    let magicGripCurve = Math.sin(C * Math.atan(bx - E * (bx - Math.atan(bx))));
    let gripFromSlip = Math.max(0.55, Math.min(1.02, magicGripCurve));

    let slipAngleTarget = Math.max(0, Math.min(16, slipNorm * 12));
    state.slipAngleDeg += (slipAngleTarget - state.slipAngleDeg) * Math.min(1, dt * 8);

    let localMaxCornerSpeedMs = localMaxCornerSpeedMsBase * gripFromSlip;
    let localMaxCornerSpeedInternal = localMaxCornerSpeedMs / INTERNAL_TO_MS;

    let isSliding = false;
    let overspeedRatio = localMaxCornerSpeedInternal > 0 ? (state.speed / localMaxCornerSpeedInternal) : 0;
    if (currCurvature > 0.15 && overspeedRatio > 1.04) {
        isSliding = true;
        let slideSeverity = Math.min(1, (overspeedRatio - 1.04) / 0.25);
        desiredThrottle *= (1 - 0.85 * slideSeverity);
        desiredBrake = Math.max(desiredBrake, 0.45 + 0.45 * slideSeverity);
        state.speed -= (brakeDecelInternal * (0.20 + 0.45 * slideSeverity)) * dt;
    }

    let pedalDt = dt * (isSliding ? 15.0 : 6.0);
    state.throttle += (desiredThrottle - state.throttle) * Math.min(1, pedalDt);
    state.brake += (desiredBrake - state.brake) * Math.min(1, pedalDt * 1.5);

    let absQuality = Math.min(1, 0.15 + (state.stats.braking / 100) * 0.85);
    let lockupRisk = Math.max(0, state.brake - 0.62)
        * Math.max(0, 1 - terrainMult * 0.95)
        * (1 - absQuality)
        * Math.min(1.5, speedMs / 22);
    state.wheelLock = Math.max(0, Math.min(1, lockupRisk * 2.3));
    if (state.wheelLock > 0) {
        state.brake *= (1 - state.wheelLock * 0.45);
        if (currCurvature > 0.1) {
            desiredThrottle *= (1 - state.wheelLock * 0.35);
            state.speed -= (brakeDecelInternal * 0.10 * state.wheelLock) * dt;
        }
    }

    let wheelRpmReal = (speedMs / (2 * Math.PI * wheelRadius)) * 60;
    let mechanicalEngineRpm = wheelRpmReal * currentGearRatio * FINAL_DRIVE_RATIO;

    if (typeof state.shiftCooldown !== 'number') state.shiftCooldown = 0;
    state.shiftCooldown = Math.max(0, state.shiftCooldown - dt);

    let upshiftThreshold = (maxCurveAhead > 0.35) ? REDLINE * 0.88 : REDLINE * 0.95;

    if (state.shiftCooldown <= 0) {
        state.isDownshifting = false;

        if (state.rpm >= upshiftThreshold && state.currentGear < gearRatios.length - 1 && state.throttle > 0.5) {
            state.currentGear++;
            state.shiftCooldown = getShiftTime(state.currentGear, false);
            currentGearRatio = getEffectiveGearRatio(state.currentGear);
        } else if (state.currentGear > 0) {
            let lowerGearRatio = getEffectiveGearRatio(state.currentGear - 1);
            let predictedRpmLowerGear = wheelRpmReal * lowerGearRatio * FINAL_DRIVE_RATIO;
            let isCornerZone = maxCurveAhead > 0.35 || state.brake > 0.2;
            let desiredCornerRpm = REDLINE * 0.65;

            if (isCornerZone && state.rpm < desiredCornerRpm && predictedRpmLowerGear < REDLINE * 0.92) {
                state.currentGear--;
                state.shiftCooldown = getShiftTime(state.currentGear, true);
                state.isDownshifting = true;
                currentGearRatio = getEffectiveGearRatio(state.currentGear);
            } else if (!isCornerZone && state.rpm < REDLINE * 0.40 && state.throttle > 0.8 && predictedRpmLowerGear < REDLINE * 0.90) {
                state.currentGear--;
                state.shiftCooldown = getShiftTime(state.currentGear, true);
                state.isDownshifting = true;
                currentGearRatio = getEffectiveGearRatio(state.currentGear);
            }
        }
    }

    let isHittingRevLimiter = false;
    let isClutchSlipping = (state.currentGear === 0 && mechanicalEngineRpm < 1500);

    if (state.shiftCooldown > 0) {
        if (state.isDownshifting) {
            let targetRevMatch = wheelRpmReal * currentGearRatio * FINAL_DRIVE_RATIO;
            state.rpm += (targetRevMatch - state.rpm) * Math.min(1, dt * 25);
        } else {
            state.rpm -= 4500 * dt;
        }
    } else if (isClutchSlipping) {
        let targetSlip = 900 + (state.throttle * 4000);
        state.rpm += (targetSlip - state.rpm) * Math.min(1, dt * 10);
    } else {
        state.rpm = mechanicalEngineRpm;
        if (state.rpm >= REDLINE) {
            isHittingRevLimiter = true;
            state.rpm = REDLINE - (Math.random() * 300 + 50);
        }
    }

    state.rpm = Math.max(900, Math.min(REDLINE, state.rpm));

    let powerDelivery = (state.shiftCooldown > 0 || isHittingRevLimiter) ? 0.0 : 1.0;
    let rpmPeak = REDLINE * 0.6;
    let rpmSpread = REDLINE * 0.4;
    let rpmDelta = (state.rpm - rpmPeak) / rpmSpread;
    let torqueFactor = Math.max(0.5, 1 - (rpmDelta * rpmDelta * 0.5));

    let accelStat = state.stats.acceleration / 100;
    let engineTorque = state.car.torque * torqueFactor * powerDelivery * state.throttle;
    let wheelForce = (engineTorque * currentGearRatio * FINAL_DRIVE_RATIO * DRIVETRAIN_EFFICIENCY * accelStat) / wheelRadius;

    let forwardAccelMs2 = (wheelForce / state.car.weight) * terrainMult;
    let forwardAccel = forwardAccelMs2 / INTERNAL_TO_MS;

    let dragForce = 0.5 * 1.225 * cdA * speedMs * speedMs;
    let dragDecelMs2 = dragForce / state.car.weight;
    let engineBrakeDecelMs2 = (0.3 + currentGearRatio * 0.1) * (1 - state.throttle);
    let passiveDecel = (dragDecelMs2 + engineBrakeDecelMs2) / INTERNAL_TO_MS;

    state.speed += forwardAccel * dt;
    state.speed -= (brakeDecelInternal * state.brake) * dt;
    state.speed -= passiveDecel * dt;
    state.speed = Math.max(0.2, state.speed);

    let postSpeedMs = state.speed * INTERNAL_TO_MS;
    let postWheelRpmReal = (postSpeedMs / (2 * Math.PI * wheelRadius)) * 60;
    let postMechanicalEngineRpm = postWheelRpmReal * currentGearRatio * FINAL_DRIVE_RATIO;

    if (state.shiftCooldown > 0) {
        if (state.isDownshifting) {
            let targetRevMatch = postWheelRpmReal * currentGearRatio * FINAL_DRIVE_RATIO;
            state.rpm += (targetRevMatch - state.rpm) * Math.min(1, dt * 28);
        } else {
            state.rpm = Math.max(postMechanicalEngineRpm * 0.82, state.rpm - 3200 * dt);
        }
    } else if (state.currentGear === 0 && postMechanicalEngineRpm < 1500) {
        let targetSlip = 900 + (state.throttle * 4000);
        state.rpm += (targetSlip - state.rpm) * Math.min(1, dt * 12);
    } else {
        state.rpm = postMechanicalEngineRpm;
        if (state.rpm >= REDLINE) {
            state.rpm = REDLINE - (Math.random() * 300 + 50);
        }
    }

    state.rpm = Math.max(900, Math.min(REDLINE, state.rpm));

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
