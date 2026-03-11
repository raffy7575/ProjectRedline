// ═════════════════════════════════════════════════════════════════════════════
//  src/main.js  —  Vite entry point (the "front door" Vite walks through)
//
//  WHAT IS THIS FILE?
//  Vite needs ONE JavaScript file to use as its starting point when it builds
//  the project.  This is it.  Its only job right now is to EXIST — the moment
//  Vite sees <script type="module" src="/src/main.js"> in index.html, it knows
//  to treat the whole project as a proper module-based app.
//
//  WHY IS IT EMPTY?
//  Because the game's JavaScript files are still the "old school" way
//  (<script src="js/race.js"> etc. in index.html).  They run in the browser's
//  global scope, which lets every file talk to every other file freely.
//  The Vite plugin in vite.config.js bundles those old-school files separately.
//
//  WHAT GOES HERE IN THE FUTURE?
//  When you're ready to modernise the JS (a future phase), you'll convert each
//  file to use  export / import  instead of globals, then add lines like:
//
//    import { startRace } from '../js/race.js'
//    import { renderGarage } from '../js/garage.js'
//    window.startRace = startRace   // keep HTML onclick= attributes working
//
//  Once ALL files are imported here, you can delete the <script src> tags from
//  index.html entirely and the Vite plugin in vite.config.js becomes unused.
//
//  RULE OF THUMB: don't touch this file until you start converting JS to modules.
// ═════════════════════════════════════════════════════════════════════════════

// Placeholder — add module imports here as JS files are progressively converted.
