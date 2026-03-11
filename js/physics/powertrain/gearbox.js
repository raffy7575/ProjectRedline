// Gearbox Logic - Shift decisions, upshifts, downshifts

function shouldUpshift(state, physics, upshiftThreshold) {
    return state.rpm >= upshiftThreshold 
        && state.currentGear < physics.gearRatios.length - 1 
    && state.throttle > 0.72
    && state.brake < 0.08;
}

function shouldDownshiftCorner(state, physics, wheelRpmReal, currentGearRatio, maxCurveAhead) {
    if (state.currentGear === 0) return false;
    
    let lowerGearRatio = getEffectiveGearRatio(physics, state.currentGear - 1);
    let predictedRpmLowerGear = calculateRpmFromWheelSpeed(wheelRpmReal, lowerGearRatio);
    let isCornerZone = maxCurveAhead > 0.42 || state.brake > 0.24;
    let desiredCornerRpm = physics.REDLINE * 0.58;

    return isCornerZone && state.rpm < desiredCornerRpm && predictedRpmLowerGear < physics.REDLINE * 0.86;
}

function shouldDownshiftAccel(state, physics, wheelRpmReal, currentGearRatio) {
    if (state.currentGear === 0) return false;
    
    let lowerGearRatio = getEffectiveGearRatio(physics, state.currentGear - 1);
    let predictedRpmLowerGear = calculateRpmFromWheelSpeed(wheelRpmReal, lowerGearRatio);

    return state.rpm < physics.REDLINE * 0.65 
        && state.throttle > 0.92 
        && predictedRpmLowerGear < physics.REDLINE * 0.90;
}

function updateRpmDuringShift(state, dt, targetRevMatch, isDownshift) {
    if (isDownshift) {
        state.rpm += (targetRevMatch - state.rpm) * Math.min(1, dt * 25);
    } else {
        let upshiftTarget = Math.max(1400, targetRevMatch * 0.78);
        state.rpm += (upshiftTarget - state.rpm) * Math.min(1, dt * 14);
    }
}

function syncRpmToWheels(state, physics, mechanicalEngineRpm) {
    state.rpm = mechanicalEngineRpm;
    if (state.rpm >= physics.REDLINE) {
        state.rpm = Math.max(physics.REDLINE * 0.965, physics.REDLINE - 140);
    }
}

function getUpshiftThreshold(physics, maxCurveAhead) {
    // Shift at ~87% on straights (around peak-power RPM) and 82% when a corner
    // is approaching — late-braking drivers stay in gear a touch longer.
    // 96.5% (old value) put the car permanently on the rev-limiter.
    return (maxCurveAhead > 0.42) ? physics.REDLINE * 0.82 : physics.REDLINE * 0.87;
}
