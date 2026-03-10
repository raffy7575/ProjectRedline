// Gearbox Logic - Shift decisions, upshifts, downshifts

function shouldUpshift(state, physics, upshiftThreshold) {
    return state.rpm >= upshiftThreshold 
        && state.currentGear < physics.gearRatios.length - 1 
        && state.throttle > 0.5;
}

function shouldDownshiftCorner(state, physics, wheelRpmReal, currentGearRatio, maxCurveAhead) {
    if (state.currentGear === 0) return false;
    
    let lowerGearRatio = getEffectiveGearRatio(physics, state.currentGear - 1);
    let predictedRpmLowerGear = calculateRpmFromWheelSpeed(wheelRpmReal, lowerGearRatio);
    let isCornerZone = maxCurveAhead > 0.35 || state.brake > 0.2;
    let desiredCornerRpm = physics.REDLINE * 0.65;

    return isCornerZone && state.rpm < desiredCornerRpm && predictedRpmLowerGear < physics.REDLINE * 0.92;
}

function shouldDownshiftAccel(state, physics, wheelRpmReal, currentGearRatio) {
    if (state.currentGear === 0) return false;
    
    let lowerGearRatio = getEffectiveGearRatio(physics, state.currentGear - 1);
    let predictedRpmLowerGear = calculateRpmFromWheelSpeed(wheelRpmReal, lowerGearRatio);

    return state.rpm < physics.REDLINE * 0.40 
        && state.throttle > 0.8 
        && predictedRpmLowerGear < physics.REDLINE * 0.90;
}

function updateRpmDuringShift(state, dt, targetRevMatch, isDownshift) {
    if (isDownshift) {
        state.rpm += (targetRevMatch - state.rpm) * Math.min(1, dt * 25);
    } else {
        state.rpm -= 4500 * dt;
    }
}

function syncRpmToWheels(state, physics, mechanicalEngineRpm) {
    state.rpm = mechanicalEngineRpm;
    if (state.rpm >= physics.REDLINE) {
        state.rpm = physics.REDLINE - (Math.random() * 300 + 50);
    }
}

function getUpshiftThreshold(physics, maxCurveAhead) {
    return (maxCurveAhead > 0.35) ? physics.REDLINE * 0.88 : physics.REDLINE * 0.95;
}
