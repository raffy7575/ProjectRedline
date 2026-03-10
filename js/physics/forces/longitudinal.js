// Longitudinal Forces - Acceleration, Deceleration, Braking

function applyLongitudinalForces(state, dt, physics, drivetrainData) {
    let engineTorque = calculateTorqueDelivery(state, physics);
    let wheelForce = (engineTorque * drivetrainData.currentGearRatio * FINAL_DRIVE_RATIO * DRIVETRAIN_EFFICIENCY) / physics.wheelRadius;

    let forwardAccelMs2 = (wheelForce / state.car.weight) * physics.terrainMult;
    let forwardAccel = forwardAccelMs2 / physics.INTERNAL_TO_MS;

    let dragDecel = calculateDragDeceleration(state, physics);
    let engineBrakeDecel = applyEngineBrake(state, physics, drivetrainData.currentGearRatio);
    let passiveDecel = dragDecel + engineBrakeDecel;

    state.speed += forwardAccel * dt;
    state.speed -= (physics.brakeDecelInternal * state.brake) * dt;
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
