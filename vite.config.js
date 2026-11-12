// Vite build config. The game is plain ES modules under src/, so no plugins
// are needed. `base: './'` lets the built game run from any sub-folder.
import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: { outDir: 'dist', emptyOutDir: true },
    server: { port: 5173 },
    test: { environment: 'node', include: ['tests/**/*.test.js'] }
});
