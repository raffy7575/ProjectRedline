// Tire Physics Model - Pacejka Magic Formula and Slip Calculations

function calculateSlipAndGrip(state, physics, currCurvature) {
    let localRadiusMeters = 35 / Math.max(0.01, currCurvature);
    let localMaxCornerSpeedMsBase = Math.sqrt(Math.max(0.01, physics.actualGrip * 9.81 * localRadiusMeters));
    let lateralAccelDemandMs2 = currCurvature > 0.01 ? ((physics.speedMs * physics.speedMs) / localRadiusMeters) : 0;
    let lateralGripCapacityMs2 = physics.actualGrip * 9.81;
    let gripDemandRatio = lateralGripCapacityMs2 > 0 ? (lateralAccelDemandMs2 / lateralGripCapacityMs2) : 0;

    let slipNorm = Math.max(0, Math.min(2.0, (gripDemandRatio - 0.75) / 0.55));
    
    // Pacejka Magic Formula parameters
    let B = 9.0, C = 1.35, E = 0.97;
    let bx = B * slipNorm;
    let magicGripCurve = Math.sin(C * Math.atan(bx - E * (bx - Math.atan(bx))));
    let gripFromSlip = Math.max(0.55, Math.min(1.02, magicGripCurve));

    let slipAngleTarget = Math.max(0, Math.min(16, slipNorm * 12));
    state.slipAngleDeg += (slipAngleTarget - state.slipAngleDeg) * Math.min(1, 0.04 * 8); // dt=0.04 typical

    let localMaxCornerSpeedMs = localMaxCornerSpeedMsBase * gripFromSlip;
    let localMaxCornerSpeedInternal = localMaxCornerSpeedMs / physics.INTERNAL_TO_MS;

    return { slipNorm, gripFromSlip, localMaxCornerSpeedInternal };
}

function detectSlidingAndLocking(state, physics, slipData, currCurvature) {
    let overspeedRatio = slipData.localMaxCornerSpeedInternal > 0 ? (state.speed / slipData.localMaxCornerSpeedInternal) : 0;
    let isSliding = (currCurvature > 0.15 && overspeedRatio > 1.04);
    
    let absQuality = Math.min(1, 0.15 + (state.stats.braking / 100) * 0.85);
    let lockupRisk = Math.max(0, state.brake - 0.62)
        * Math.max(0, 1 - physics.terrainMult * 0.95)
        * (1 - absQuality)
        * Math.min(1.5, physics.speedMs / 22);
    
    return {
        isSliding,
        wheelLock: Math.max(0, Math.min(1, lockupRisk * 2.3))
    };
}

function updateTireSlipAngle(state, dt) {
    if (typeof state.slipAngleDeg !== 'number') state.slipAngleDeg = 0;
    // Slippage is handled in calculateSlipAndGrip
}
