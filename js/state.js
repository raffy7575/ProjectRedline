let selectedPlayerCar = null;
let raceState = [];
let animationId;
let lastTime = 0;
let trackPath = [];
let globalRaceTime = 0;
let isSkippingSimulation = false;
let isFastForwardingNow = false;

const CANVAS_W = 600;
const CANVAS_H = 300;
const TIME_MULTIPLIER = 1.0;
const MAX_FRAME_DT = 0.05;
const PROGRESS_SCALE = 10;
const SKIP_SIM_SPEED = 50.0;
const SPEED_TO_MS = 28;
const METERS_PER_PROGRESS_STEP = 1.35;
const FINAL_DRIVE_RATIO = 3.9;
const DRIVETRAIN_EFFICIENCY = 0.88;
