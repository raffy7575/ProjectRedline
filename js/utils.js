/* =============================================================================
    js/utils.js  —  Shared tiny helper functions

    WHAT THIS FILE DOES
    - Stores small reusable utility helpers used by multiple modules.
    - Keeps tiny formatting logic out of gameplay files.

    CURRENT CONTENT
    - `formatLapTime(seconds)` converts numeric seconds into MM:SS.CC.

    SAFE TO EDIT
    - Output format of lap time string if UI/telemetry requirements change.
    ============================================================================= */

function formatLapTime(seconds) {
    let m = Math.floor(seconds / 60);
    let s = Math.floor(seconds % 60);
    let ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
