// ═════════════════════════════════════════════════════════════════════════════
//  vite.config.js  —  Project Redline build pipeline
//
//  WHAT IS THIS FILE?
//  Think of this like the recipe card for baking the final game.
//  When you type `npm run build`, Vite reads this file and follows every
//  instruction to pack, squish, and rename all your code into a tiny
//  ready-to-host "dist/" folder.  When you type `npm run dev` it uses
//  this file to start a fast local server while you're still building.
//
//  HOW TO USE THE THREE COMMANDS
//  ┌─────────────────────┬──────────────────────────────────────────────┐
//  │ npm run dev         │ Start coding – auto-refreshes on save        │
//  │ npm run build       │ Package everything → creates dist/ folder    │
//  │ npm run preview     │ Test the dist/ folder locally before upload  │
//  └─────────────────────┴──────────────────────────────────────────────┘
// ═════════════════════════════════════════════════════════════════════════════

import { defineConfig } from 'vite'   // core Vite API
import { readFileSync } from 'fs'     // Node built-in: read a file from disk
import { resolve } from 'path'        // Node built-in: build full file paths
import { minify } from 'terser'       // Terser: squishes JS to remove whitespace / rename variables

// ─────────────────────────────────────────────────────────────────────────────
//  bundleClassicScripts()
//
//  WHAT THIS DOES (plain English):
//  All the game's JavaScript files are still loaded the "old-school" way —
//  plain <script src="..."> tags in index.html.  Vite only knows how to
//  bundle modern ES-module scripts by default, so this custom plugin teaches
//  it to also handle the old-school ones.
//
//  In three steps:
//    STEP 1  (pre)  – Read index.html, find every <script src="…"> tag that
//                     is NOT a module, note each file path, then REMOVE those
//                     tags from the HTML (we'll add one combined tag later).
//    STEP 2  (mid)  – Read the actual JS files in order, glue them together
//                     into one big string, then squish it with Terser so
//                     it's as small as possible.  Save it as game-[hash].js.
//    STEP 3  (post) – Write ONE new <script src="/assets/game-[hash].js">
//                     tag back into the HTML, replacing all the removed ones.
//
//  Result: 22 separate JS requests → 1 tiny hashed request. ✓
//
//  WHY TWO PLUGINS instead of one?
//  Vite doesn't allow the same hook name (transformIndexHtml) twice in one
//  plugin object.  So we split the logic into two cooperating plugin objects
//  that share data through the 'collected' and 'bundleFileName' variables.
//
//  ONLY RUNS DURING `npm run build` — during `npm run dev` all scripts are
//  served individually for faster reload.
// ─────────────────────────────────────────────────────────────────────────────
function bundleClassicScripts() {
  // Shared state between the two plugins (like passing notes between friends)
  const root      = process.cwd()   // absolute path to the project folder
  const collected = []              // ordered list of script src paths found in HTML
  let   bundleFileName = ''         // filled in STEP 2, used in STEP 3

  // Regular expression: matches any <script src="..."> that is NOT type="module"
  // You don't need to touch this unless the HTML structure of <script> tags changes
  const CLASSIC_RE =
    /<script(?![^>]*type=["']module["'])\s+src="([^"]+)"[^>]*><\/script>/g

  // ── PLUGIN 1: STEP 1 + STEP 2 ─────────────────────────────────────────────
  const pluginCollect = {
    name: 'redline:collect-classic-scripts',  // name shown in Vite error messages
    apply: 'build',                           // only active during `npm run build`

    // Called once at the very start of a build — reset shared state
    buildStart() {
      collected.length = 0
      bundleFileName   = ''
    },

    // STEP 1: runs on index.html BEFORE Vite processes anything else (order: 'pre')
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let m
        const re = new RegExp(CLASSIC_RE.source, CLASSIC_RE.flags) // fresh regex state
        while ((m = re.exec(html)) !== null) {
          collected.push(m[1])   // save e.g. "js/race.js", "engine.js", etc.
        }
        // Strip all matched <script src> tags from the HTML
        return html.replace(new RegExp(CLASSIC_RE.source, CLASSIC_RE.flags), '')
      },
    },

    // STEP 2: runs after all modules are processed — glue + minify + emit
    async generateBundle() {
      if (collected.length === 0) return   // nothing to do if no scripts found

      // Read every collected file from disk in the same order they appeared in HTML
      const parts = collected.map((src) => {
        const filePath = resolve(root, src.replace(/^\//, ''))
        return readFileSync(filePath, 'utf-8')
      })

      // Join them with semicolons so they don't bleed into each other
      const combined = parts.join('\n;\n')

      // Terser options — what the squisher does:
      //   compress.drop_console: false  → keep console.log() calls (set true to strip them in production)
      //   compress.passes: 2            → run the compressor twice for a smaller result
      //   mangle: true                  → rename local variables to single letters (a, b, c…)
      //   format.comments: false        → remove all /* comments */ from the output file
      const result = await minify(combined, {
        compress : { drop_console: false, passes: 2 },
        mangle   : true,
        format   : { comments: false },
      })

      // Tell Vite "save this as an asset called game.js" — Vite adds a hash automatically
      const refId    = this.emitFile({ type: 'asset', name: 'game.js', source: result.code })
      bundleFileName = this.getFileName(refId)   // e.g. "assets/game-Bc562vPH.js"
    },
  }

  // ── PLUGIN 2: STEP 3 ──────────────────────────────────────────────────────
  const pluginInject = {
    name: 'redline:inject-game-bundle',   // name shown in Vite error messages
    apply: 'build',                       // only active during `npm run build`

    // STEP 3: runs on index.html AFTER Vite has finished everything (order: 'post')
    // Inserts the single combined <script> tag right before </body>
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!bundleFileName) return html   // safety: nothing emitted, do nothing
        return html.replace(
          '</body>',
          `  <script src="/${bundleFileName}"></script>\n</body>`,
        )
      },
    },
  }

  // Return BOTH plugins as an array — Vite registers them both
  return [pluginCollect, pluginInject]
}

// ═════════════════════════════════════════════════════════════════════════════
//  Main Vite configuration
//
//  THINGS YOU MIGHT WANT TO CHANGE:
//  ┌────────────────────────┬────────────────────────────────────────────────┐
//  │ server.port            │ Change 5173 to any free port (e.g. 3000)       │
//  │ build.outDir           │ Change 'dist' if your host wants a diff folder │
//  │ base                   │ Change '/' if the game lives in a subfolder    │
//  │                        │ e.g. '/game/' if hosted at mysite.com/game/    │
//  │ drop_console (above)   │ Set to true before going live to strip logs    │
//  │ chunkSizeWarningLimit  │ Raise if Vite warns about large files          │
//  └────────────────────────┴────────────────────────────────────────────────┘
// ═════════════════════════════════════════════════════════════════════════════
export default defineConfig({
  root : '.',   // project root = this folder (where index.html lives)
  base : '/',   // URL base path — change to '/subfolder/' if the game is at mysite.com/game/

  build: {
    outDir     : 'dist',   // ← the folder created by `npm run build`; upload THIS to your host
    emptyOutDir: true,     // wipe dist/ clean before each build (prevents stale files)

    rollupOptions: {
      input: 'index.html',   // Vite starts bundling from index.html
    },

    // esbuild handles the Vite-owned code (src/main.js).
    // Our game JS is minified by Terser in the plugin above instead.
    minify: 'esbuild',

    // Warn if a single chunk exceeds this size in kB (raise if you see warnings)
    chunkSizeWarningLimit: 1024,
  },

  plugins: [bundleClassicScripts()],   // register our custom two-plugin bundler

  server: {
    port: 5173,   // `npm run dev` will open at http://localhost:5173
    open: false,  // set to true to auto-open the browser when you run npm run dev
  },
})
