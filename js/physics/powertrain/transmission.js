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

function shouldUseLaunchClutch(state, mechanicalEngineRpm) {
    return state.currentGear === 0 && ((state.clutchEngagement || 0) < 0.98 || mechanicalEngineRpm < Math.max(2200, state.rpm * 0.72));
}

function updateLaunchClutch(state, dt, physics, mechanicalEngineRpm) {
    let throttleInfluence = 0.65 + state.throttle * 0.75;
    let speedInfluence = Math.min(1, physics.speedMs / 18);
    state.clutchEngagement = Math.min(1, (state.clutchEngagement || 0) + dt * (0.85 + throttleInfluence * 0.55 + speedInfluence * 0.8));

    let targetSlipRpm = Math.min(physics.REDLINE * 0.82, 1800 + state.throttle * (physics.REDLINE * 0.38));
    let blendedRpm = (targetSlipRpm * (1 - state.clutchEngagement)) + (mechanicalEngineRpm * state.clutchEngagement);
    let rpmResponse = 8 + state.clutchEngagement * 10;
    blendRpmToTarget(state, blendedRpm, dt, rpmResponse);
}

function handleRevLimiter(state, physics) {
    if (state.rpm >= physics.REDLINE) {
        state.rpm = Math.max(physics.REDLINE * 0.965, physics.REDLINE - 140);
        return true;
    }
    return false;
}

function blendRpmToTarget(state, targetRpm, dt, responseRate) {
    state.rpm += (targetRpm - state.rpm) * Math.min(1, dt * responseRate);
}

function applyEngineBrake(state, physics, currentGearRatio) {
    // Engine braking is directly related to gear ratio (higher gear = less braking)
    // When braking, engine braking effect is amplified for more realistic downshift feel
    let baseBrake = (0.3 + currentGearRatio * 0.1);
    let throttleEffect = (1 - state.throttle);
    
    // When in gear and braking (no throttle), engine provides strong braking
    let engineBrakeDecelMs2 = baseBrake * throttleEffect;
    
    // Apply wheel speed consideration - more effective at lower speeds
    let speedEffect = Math.max(0.6, 1.0 - (physics.speedMs / 50));
    engineBrakeDecelMs2 *= speedEffect;
    
    return engineBrakeDecelMs2 / physics.INTERNAL_TO_MS;
}

function calculateTorqueDelivery(state, physics) {
    let rpmPeak = physics.REDLINE * 0.6;
    let rpmSpread = physics.REDLINE * 0.4;
    let rpmDelta = (state.rpm - rpmPeak) / rpmSpread;
    let torqueFactor = Math.max(0.5, 1 - (rpmDelta * rpmDelta * 0.5));
    
    let powerDelivery = (state.shiftCooldown > 0) ? 0.0 : 1.0;
    if (state.currentGear === 0) {
        let clutchCoupling = 0.35 + (Math.max(0, Math.min(1, state.clutchEngagement || 0)) * 0.65);
        powerDelivery *= clutchCoupling;
    }
    let accelStat = Math.max(0.40, state.stats.acceleration / 100);
    let engineTorque = state.car.torque * torqueFactor * powerDelivery * state.throttle;
    
    return engineTorque * accelStat;
}
