# Project Redline

A street-racing career game for the browser. Buy a car, tune it under a
performance cap, and climb four leagues. Races are live: you launch off the
lights, choose when to push or save your tyres, and decide where to spend
your nitro.

No framework and no assets pipeline: plain ES modules, one canvas, synthesised
audio. Runs on desktop and mobile.

## Run it

```bash
npm ci
```

```bash
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Simulation, career and save tests (vitest) |
| `npm run build` | Production build in `dist/` (works from any sub-folder) |
| `npm run preview` | Serve `dist/` locally |

## How to play

| Input | Action |
|-------|--------|
| `Space` (or the NITRO button) | Launch when the five lights go out, then hold for nitro |
| `1` / `2` / `3` | Pace: Save, Race, Push |
| `C` | Chase camera / full-track view |
| `P` or `Esc` | Pause |

- **Performance Index (PI)** is measured by lapping your exact build on a
  reference circuit. Each league caps PI, so tuning is about the best car
  under the limit. Owned parts can be fitted and removed for free.
- **Tyres** fade gently, then fall off a cliff past 85% wear. Push is faster
  but burns them and risks lock-ups.
- **Nitro** does not refill, apart from a trickle while slipstreaming.
- Meet an event's target position to unlock the next one. Finish a league to
  unlock the next class, plus wear and maintenance, rival intel and limited
  edition cars.

## Code map

```
src/
  main.js            entry point
  core/              rng helpers, game state + save/load/migration
  data/              cars, upgrades, tracks, leagues, rivals, skills (edit these to add content)
  sim/               the simulation, no DOM: track geometry, vehicle model,
                     lap-time solver, race session
  game/              rules on top of the sim: PI, garage, career, rival economy,
                     progression, daily challenge, dealer
  render/raceView.js canvas renderer (scenery, track, cars, minimap)
  audio/audio.js     WebAudio synth
  ui/                screens, race HUD, modals
tests/               vitest suites (run in Node, no browser needed)
docs/STATUS.md       audit of the prototype, what changed, what is left
```

Everything in `sim/` works in SI units (metres, seconds, kg) and advances in
fixed 1/60 s steps with a seeded random generator, so a race is reproducible
and gives the same result at 1x, 4x or when skipped.

### Adding content

- **A car**: add an object to `src/data/cars.js`. Run `npm test`: a test checks
  every stock car fits its class PI cap.
- **A track**: add control points and a lap length to `src/data/tracks.js`.
  The builder scales the loop to the length you give.
- **An event or league**: edit `src/data/leagues.js`.

Car and upgrade ids are stored in save files. Do not rename existing ids.
