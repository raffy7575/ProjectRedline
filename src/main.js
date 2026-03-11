/**
 * src/main.js  –  Vite entry point.
 *
 * Vite discovers this file via the <script type="module"> tag in index.html.
 * Its presence tells Vite to process index.html as a module-graph root.
 *
 * CSS is loaded via the <link rel="stylesheet" href="css/main.css"> in
 * index.html.  Vite bundles it into a single hashed CSS file in production
 * because it follows the @import chain in css/main.css.
 *
 * The game's JavaScript files are classic <script> tags so they retain global
 * scope (required by onclick= attributes and cross-file function calls).
 * In production, the vite.config.js bundleClassicScripts plugin concatenates
 * and minifies them into a single assets/game-[hash].js bundle.
 *
 * ── Future migration path ─────────────────────────────────────────────────
 * Convert each JS file to an ES module (add export/import statements), then
 * import them here and expose any HTML-callable globals via window.xxx = xxx.
 * Once all files are modules, delete the classic <script> tags from index.html.
 * ─────────────────────────────────────────────────────────────────────────── */

// Placeholder – add module imports here as JS is progressively converted.
