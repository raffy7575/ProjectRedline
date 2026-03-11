/* =============================================================================
    js/physics/aero/aerodynamics.js  —  Aerodynamic calculations

    WHAT THIS FILE DOES
    - Computes downforce and load factor from speed and car aero values
    - Computes drag deceleration
    - Estimates drag-limited top speed from power

    SAFE THINGS TO EDIT
    - Coefficients used for balancing downforce vs drag feel
    - Default fallbacks for missing car aero properties
    ============================================================================= */

function calculateAerodynamicContext(state, car, physics) {
    const rhoAir = 1.225; // Air density at sea level
    
    let handlingFactor = state.stats.handling / 100;
    let clA = Math.max(0.2, (car.downforceCoeff || 0.75) * (0.8 + handlingFactor * 0.6));
    let downforceN = 0.5 * rhoAir * clA * physics.speedMs * physics.speedMs;
    let staticLoadN = car.weight * 9.81;
    let aeroLoadFactor = Math.max(1.0, (staticLoadN + downforceN) / staticLoadN);

    return { downforceN, aeroLoadFactor };
}

function calculateDragDeceleration(state, physics) {
    let dragForce = 0.5 * 1.225 * physics.cdA * physics.speedMs * physics.speedMs;
    let dragDecelMs2 = dragForce / state.car.weight;
    return dragDecelMs2 / physics.INTERNAL_TO_MS;
}

function calculateMaxSpeedFromPower(car, stats, terrainMult) {
    const INTERNAL_TO_MS = PROGRESS_SCALE * METERS_PER_PROGRESS_STEP;
    const rhoAir = 1.225;
    
    let hpAjustado = car.hp * (0.5 + (stats.topSpeed / 200));
    let powerWatts = hpAjustado * 745.7;
    let cdA = Math.max(0.2, car.dragCoeff * 2.1);
    // Apply terrainMult inside the cube root: at drag-limited top speed,
    // P_available * terrainMult = P_drag  =>  v_max = (P * t / (0.5*rho*cdA))^(1/3)
    let vmaxMs = Math.pow(powerWatts * terrainMult / (0.5 * rhoAir * cdA), 1 / 3);
    
    return vmaxMs / INTERNAL_TO_MS;
}

function getLoadSensitiveGrip(baseGrip, aeroLoadFactor, terrainMult) {
    let loadSensitiveGrip = baseGrip * (0.86 + 0.20 * Math.sqrt(aeroLoadFactor));
    return loadSensitiveGrip * terrainMult;
}
