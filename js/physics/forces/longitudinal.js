// Longitudinal Forces - Acceleration, Deceleration, Braking

function applyLongitudinalForces(state, dt, physics, drivetrainData) {
    let engineTorque = calculateTorqueDelivery(state, physics);
    let wheelForce = (engineTorque * drivetrainData.currentGearRatio * FINAL_DRIVE_RATIO * DRIVETRAIN_EFFICIENCY) / physics.wheelRadius;

    let forwardAccelMs2 = (wheelForce / state.car.weight) * physics.terrainMult;
    let forwardAccel = forwardAccelMs2 / physics.INTERNAL_TO_MS;

    // Enhanced drag and engine braking
    let dragDecel = calculateDragDeceleration(state, physics);
    let engineBrakeDecel = applyEngineBrake(state, physics, drivetrainData.currentGearRatio);
    
    // Amplify engine braking effect when braking (more realistic downshift braking)
    let brakingEngineBrakeFactor = 1.0 + (state.brake * 2.5); // Up to 3.5x engine brake when hard braking
    engineBrakeDecel *= brakingEngineBrakeFactor;
    
    let passiveDecel = dragDecel + engineBrakeDecel;

    // Apply deceleration with smooth ramping to avoid instantaneous stops
    let targetSpeed = state.speed;
    
    if (state.brake > 0.1) {
        // Smooth braking deceleration (not instantaneous)
        let brakeDecel = physics.brakeDecelInternal * state.brake * 0.85; // 85% of max to allow engine braking
        let smoothBrakeRamp = 1.0 - Math.pow(1.0 - Math.min(1.0, state.brake), 0.5); // Smoother ramp
        targetSpeed -= brakeDecel * smoothBrakeRamp * dt;
    }
    
    state.speed += forwardAccel * dt;
    state.speed -= (physics.brakeDecelInternal * state.brake * 0.15) * dt; // Remaining brake force
    state.speed -= passiveDecel * dt;
    state.speed = Math.max(0.2, state.speed);
}

function calculateWheelForceFromTorque(torque, gearRatio, wheelRadius) {
    return (torque * gearRatio * FINAL_DRIVE_RATIO * DRIVETRAIN_EFFICIENCY) / wheelRadius;
}

function applyBrakingForce(state, dt, physics) {
    state.speed -= (physics.brakeDecelInternal * state.brake) * dt;
}

function applyDragAndBraking(state, dt, physics) {
    let dragDecel = calculateDragDeceleration(state, physics);
    let engineBrakeDecel = applyEngineBrake(state, physics, state.car.gearRatios[Math.max(0, Math.min(state.currentGear, state.car.gearRatios.length - 1))]);
    state.speed -= (dragDecel + engineBrakeDecel) * dt;
}

function clampSpeed(state) {
    state.speed = Math.max(0.2, state.speed);
}
