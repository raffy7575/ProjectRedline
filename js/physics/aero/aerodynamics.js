// Aerodynamic Physics - Downforce, Drag, and Air Resistance

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
    let vmaxMs = Math.pow(powerWatts / (0.5 * rhoAir * cdA), 1 / 3);
    
    return vmaxMs / INTERNAL_TO_MS; // Terrain multiplier applied separately
}

function getLoadSensitiveGrip(baseGrip, aeroLoadFactor, terrainMult) {
    let loadSensitiveGrip = baseGrip * (0.86 + 0.20 * Math.sqrt(aeroLoadFactor));
    return loadSensitiveGrip * terrainMult;
}
