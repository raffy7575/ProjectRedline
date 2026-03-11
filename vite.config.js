import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { minify } from 'terser'

// ─────────────────────────────────────────────────────────────────────────────
// bundleClassicScripts()
//
// Returns TWO Vite plugins that cooperate via shared closure state:
//
//   Phase A (pre-transform):  strip classic <script src> tags, record their paths
//   Phase B (generateBundle): concatenate + minify all collected scripts, emit
//                             as a single hashed asset
//   Phase C (post-transform): inject the emitted bundle's <script> into HTML
//
// Only active during `vite build`.  In `vite dev` every script is served as-is.
// ─────────────────────────────────────────────────────────────────────────────
function bundleClassicScripts() {
  const root      = process.cwd()
  const collected = []            // ordered list of src paths collected in Phase A
  let   bundleFileName = ''       // set in Phase B, consumed in Phase C

  // Matches any <script src="…"> that is NOT a module script
  const CLASSIC_RE =
    /<script(?![^>]*type=["']module["'])\s+src="([^"]+)"[^>]*><\/script>/g

  // ── Plugin A: collect + strip ────────────────────────────────────────────
  const pluginCollect = {
    name: 'redline:collect-classic-scripts',
    apply: 'build',

    buildStart() {
      collected.length = 0
      bundleFileName   = ''
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let m
        const re = new RegExp(CLASSIC_RE.source, CLASSIC_RE.flags) // fresh state
        while ((m = re.exec(html)) !== null) {
          collected.push(m[1])
        }
        return html.replace(new RegExp(CLASSIC_RE.source, CLASSIC_RE.flags), '')
      },
    },

    async generateBundle() {
      if (collected.length === 0) return

      const parts = collected.map((src) => {
        const filePath = resolve(root, src.replace(/^\//, ''))
        return readFileSync(filePath, 'utf-8')
      })

      const combined = parts.join('\n;\n')

      const result = await minify(combined, {
        compress : { drop_console: false, passes: 2 },
        mangle   : true,
        format   : { comments: false },
      })

      const refId      = this.emitFile({ type: 'asset', name: 'game.js', source: result.code })
      bundleFileName   = this.getFileName(refId)
    },
  }

  // ── Plugin B: inject bundle reference into final HTML ────────────────────
  const pluginInject = {
    name: 'redline:inject-game-bundle',
    apply: 'build',

    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!bundleFileName) return html
        return html.replace(
          '</body>',
          `  <script src="/${bundleFileName}"></script>\n</body>`,
        )
      },
    },
  }

  return [pluginCollect, pluginInject]
}

// ─────────────────────────────────────────────────────────────────────────────
export default defineConfig({
  root : '.',
  base : '/',

  build: {
    outDir  : 'dist',
    emptyOutDir: true,

    rollupOptions: {
      input: 'index.html',
    },

    // Terser handles JS via the plugin above; Vite handles CSS minification
    minify: 'esbuild',

    chunkSizeWarningLimit: 1024,
  },

  plugins: [bundleClassicScripts()],

  server: {
    port: 5173,
    open: false,
  },
})
