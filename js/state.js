/* =============================================================================
	 js/state.js  —  Global runtime state + simulation constants

	 WHAT THIS FILE DOES
	 - Holds mutable runtime state used across many files (selected car, race flags,
		 animation frame id, timing, active event, etc.)
	 - Defines shared simulation constants used by physics/render systems

	 SAFE THINGS TO EDIT
	 - Tuning constants (with small increments + testing):
			 `TIME_MULTIPLIER`, `MAX_FRAME_DT`, `SKIP_SIM_SPEED`,
			 `BRAKE_DISTANCE_SAFETY_MARGIN`, `CURVE_SPEED_SAFETY_MARGIN`

	 CAUTION
	 - These are globals consumed by multiple files. Renaming a variable here
		 requires updating every reference everywhere.
	 ============================================================================= */

// ── Mutable runtime state ────────────────────────────────────────────────────
let selectedPlayerCar = null;
let raceState = [];
let animationId;
let isRaceActive = false;
let lastTime = 0;
let trackPath = [];
let globalRaceTime = 0;
let currentRaceEvent = null;
let isSkippingSimulation = false;
let isFastForwardingNow = false;

// ── Canvas / simulation constants ────────────────────────────────────────────
const CANVAS_W = 1920;
const CANVAS_H = 1080;
const TIME_MULTIPLIER = 1.0;
const MAX_FRAME_DT = 0.05;
const PROGRESS_SCALE = 10;
const SKIP_SIM_SPEED = 50.0;
const SPEED_TO_MS = 28;
const METERS_PER_PROGRESS_STEP = 1.35;
const FINAL_DRIVE_RATIO = 3.9;
const DRIVETRAIN_EFFICIENCY = 0.88;
const BRAKE_DISTANCE_SAFETY_MARGIN = 0.58;
const CURVE_SPEED_SAFETY_MARGIN = 0.90;
const CURRENT_CURVE_SPEED_MARGIN = 0.94;
const CURVE_URGENCY_SPEED_PENALTY = 0.28;
const EARLY_BRAKE_CURVATURE_THRESHOLD = 0.08;
