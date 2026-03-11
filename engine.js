/* =============================================================================
   engine.js  —  App bootstrap entry point

   WHAT THIS FILE DOES
   - Waits for the page to load
   - Kicks off `initializePersistentState()` once the DOM is ready

   WHY KEEP THIS FILE?
   - It gives you one tiny stable place to control startup behavior.
   - Future startup hooks (analytics, feature flags, diagnostics) can go here.
   ============================================================================= */

window.onload = function() {
    // Begin loading saved game data, then build UI from that state.
    initializePersistentState();
};