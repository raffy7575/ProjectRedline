// Powertrain Physics - Gears, Ratios, RPM, Clutch, and Rev Limiter

function getEffectiveGearRatio(physics, gearIdx) {
    let base = physics.gearRatios[Math.max(0, Math.min(gearIdx, physics.gearRatios.length - 1))] || 1.0;
    let shortGearBoost = gearIdx <= 2 ? (1.03 + (physics.accelStatNorm * 0.05) + (physics.powerToWeight * 0.06)) : 1.0;
    let highGearTrim = gearIdx >= 3 ? 0.985 : 1.0;
    return base * shortGearBoost * highGearTrim;
}

function getShiftTimeForState(state, physics, targetGearIdx, isDownshift) {
    let statFactor = 1.0 - (physics.accelStatNorm * 0.20) - (physics.powerToWeight * 0.10);
    statFactor = Math.max(0.72, Math.min(1.05, statFactor));
    let earlyGearFactor = targetGearIdx <= 2 ? 0.72 : 1.0;
    let downshiftFactor = isDownshift ? 0.90 : 1.0;
    return Math.max(0.055, state.shiftTimeRequired * statFactor * earlyGearFactor * downshiftFactor);
}

function calculateMechanicalEngineRpm(speedMs, gearRatio, wheelRadius) {
    let wheelRpmReal = (speedMs / (2 * Math.PI * wheelRadius)) * 60;
    let mechanicalEngineRpm = wheelRpmReal * gearRatio * FINAL_DRIVE_RATIO;
    return mechanicalEngineRpm;
}

function calculateRpmFromWheelSpeed(wheelRpmReal, gearRatio) {
    return wheelRpmReal * gearRatio * FINAL_DRIVE_RATIO;
}

function handleClutchSlipping(state, dt, targetSlip) {
    if (state.currentGear === 0) {
        let targetSlipRpm = 900 + (state.throttle * 4000);
        state.rpm += (targetSlipRpm - state.rpm) * Math.min(1, dt * 10);
    }
}

function handleRevLimiter(state, physics) {
    if (state.rpm >= physics.REDLINE) {
        state.rpm = physics.REDLINE - (Math.random() * 300 + 50);
        return true;
    }
    return false;
}

function applyEngineBrake(state, physics, currentGearRatio) {
    let engineBrakeDecelMs2 = (0.3 + currentGearRatio * 0.1) * (1 - state.throttle);
    return engineBrakeDecelMs2 / physics.INTERNAL_TO_MS;
}

function calculateTorqueDelivery(state, physics) {
    let rpmPeak = physics.REDLINE * 0.6;
    let rpmSpread = physics.REDLINE * 0.4;
    let rpmDelta = (state.rpm - rpmPeak) / rpmSpread;
    let torqueFactor = Math.max(0.5, 1 - (rpmDelta * rpmDelta * 0.5));
    
    let powerDelivery = (state.shiftCooldown > 0) ? 0.0 : 1.0;
    let accelStat = state.stats.acceleration / 100;
    let engineTorque = state.car.torque * torqueFactor * powerDelivery * state.throttle;
    
    return engineTorque * accelStat;
}
