// Longitudinal Forces - Acceleration, Deceleration, Braking

function applyLongitudinalForces(state, dt, physics, drivetrainData) {
    let engineTorque = calculateTorqueDelivery(state, physics);
    let wheelForce = (engineTorque * drivetrainData.currentGearRatio * FINAL_DRIVE_RATIO * DRIVETRAIN_EFFICIENCY) / physics.wheelRadius;

    let forwardAccelMs2 = (wheelForce / state.car.weight) * physics.terrainMult;
    let forwardAccel = forwardAccelMs2 / physics.INTERNAL_TO_MS;

    // Drag and engine braking (foot brake and engine brake are independent)
    let dragDecel = calculateDragDeceleration(state, physics);
    let engineBrakeDecel = 0;
    let clutchEngagement = typeof state.clutchEngagement === 'number' ? state.clutchEngagement : 1;
    if ((state.shiftCooldown || 0) <= 0 && clutchEngagement > 0.96) {
        engineBrakeDecel = applyEngineBrake(state, physics, drivetrainData.currentGearRatio);
    }
    let passiveDecel = dragDecel + engineBrakeDecel;

    // Apply full braking force with smooth ramping curve
    if (state.brake > 0.05) {
        // Smooth brake application curve (more progressive at lower inputs, sharper at high)
        let smoothBrakeRamp = Math.pow(state.brake, 1.1);
        let totalBrakeForce = physics.brakeDecelInternal * smoothBrakeRamp;
        state.speed -= totalBrakeForce * dt;
    }
    
    state.speed += forwardAccel * dt;
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
