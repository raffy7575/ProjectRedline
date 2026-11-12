// The live race: HUD, player input, the frame loop and the results screen.

import { state } from '../core/store.js';
import { createRace, stepRace, simulateToEnd, classify, pressLaunch, DT, PACE_MODES } from '../sim/race.js';
import { createRaceView } from '../render/raceView.js';
import { applyRaceResult } from '../game/career.js';
import { sfx, startEngine, updateEngine, stopEngine } from '../audio/audio.js';
import { esc, money, fmtTime, ordinal } from './dom.js';

let active = null;

export function isRaceRunning() {
    return !!active;
}

const hudHtml = (setup) => `
    <canvas id="race-canvas"></canvas>
    <div class="rh rh-tower" id="rh-tower"></div>
    <div class="rh rh-top">
        <div class="rh-box"><small>Position</small><b id="rh-pos">-</b></div>
        <div class="rh-box"><small>Lap</small><b id="rh-lap">-</b></div>
        <div class="rh-box hide-s"><small>Race time</small><b id="rh-time">0:00.00</b></div>
        <div class="rh-box hide-s"><small>Last lap</small><b id="rh-last">--</b></div>
        <div class="rh-box hide-s"><small>Gap ahead</small><b id="rh-gap">--</b></div>
    </div>
    <div class="rh rh-mini">
        <canvas id="race-mini"></canvas>
        <div class="rh-ctl">
            <button data-race="speed" data-v="1" class="on">1x</button>
            <button data-race="speed" data-v="2">2x</button>
            <button data-race="speed" data-v="4">4x</button>
            <button data-race="camera" title="Toggle camera (C)">Cam</button>
        </div>
        <div class="rh-ctl">
            <button data-race="pause" title="Pause (P)">Pause</button>
            <button data-race="skip" title="Simulate the rest of the race">Skip ⏭</button>
        </div>
    </div>
    <div class="rh rh-center" id="rh-center">
        <div class="lights" id="rh-lights"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="launch-tip" id="rh-tip">HIT SPACE WHEN THE LIGHTS GO OUT</div>
    </div>
    <div class="rh rh-feed" id="rh-feed"></div>
    <div class="rh rh-dash">
        <div class="pace" role="group" aria-label="Pace mode">
            <button data-race="pace" data-pace="push"><kbd>3</kbd>PUSH</button>
            <button data-race="pace" data-pace="race" class="on"><kbd>2</kbd>RACE</button>
            <button data-race="pace" data-pace="save"><kbd>1</kbd>SAVE</button>
        </div>
        <div class="dash-main">
            <div class="dash-speed"><span><span class="v" id="rh-speed">0</span> <span class="muted">km/h</span></span><span class="muted">${esc(setup.event.name)}</span><span class="gear" id="rh-gear">1</span></div>
            <div class="rpm"><i id="rh-rpm"></i></div>
            <div class="meter"><span>TYRES</span><div class="bar"><i id="rh-tyre" style="width:100%"></i></div><b id="rh-tyre-n">100</b></div>
            <div class="meter"><span>NITRO</span><div class="bar"><i id="rh-nitro" style="width:100%;background:var(--blue)"></i></div><b id="rh-nitro-n">100</b></div>
        </div>
        <button class="nitro-btn" id="rh-nitro-btn" aria-label="Nitro (hold)"><span><kbd>SPACE</kbd></span>NITRO</button>
    </div>`;

export function startRace(setup, onDone) {
    const root = document.getElementById('race-root');
    root.hidden = false;
    root.innerHTML = hudHtml(setup);
    const $ = (id) => root.querySelector(`#${id}`);

    const race = createRace(setup);
    const view = createRaceView($('race-canvas'), $('race-mini'), race);
    view.setCameraMode(state.settings.camera || 'follow');
    const player = race.player;

    const session = {
        race, view, setup, speed: 1, paused: false, acc: 0, last: 0, raf: 0,
        feedSeen: 0, lightsShown: 0, went: false, pushSteps: 0, steps: 0,
        finishedShown: false, done: false, lastPos: 0
    };
    active = session;

    // Position tower rows are created once and moved with CSS.
    const tower = $('rh-tower');
    tower.style.height = `${race.cars.length * 26}px`;
    const rows = new Map();
    race.cars.forEach(car => {
        const row = document.createElement('div');
        row.className = `tower-row${car.isPlayer ? ' me' : ''}`;
        row.innerHTML = `<span class="p"></span><span class="c" style="background:${car.entry.color}"></span><span class="n">${esc(car.isPlayer ? state.name : car.entry.name)}</span><span class="g"></span>`;
        tower.appendChild(row);
        rows.set(car.id, { row, p: row.children[0], g: row.children[3] });
    });

    const setPace = (pace) => {
        if (!PACE_MODES[pace]) return;
        race.input.pace = pace;
        root.querySelectorAll('[data-race="pace"]').forEach(b => b.classList.toggle('on', b.dataset.pace === pace));
    };
    const nitroDown = () => {
        if (race.phase === 'countdown' || (race.phase === 'racing' && race.time < 0.6 && race.launch.pressedAt === null)) {
            pressLaunch(race);
        }
        race.input.nitro = true;
    };
    const nitroUp = () => { race.input.nitro = false; };
    const setSpeed = (v) => {
        session.speed = v;
        root.querySelectorAll('[data-race="speed"]').forEach(b => b.classList.toggle('on', Number(b.dataset.v) === v));
    };
    const togglePause = () => {
        session.paused = !session.paused;
        root.querySelector('[data-race="pause"]').textContent = session.paused ? 'Resume' : 'Pause';
    };
    const toggleCamera = () => {
        const next = view.getCameraMode() === 'follow' ? 'overview' : 'follow';
        view.setCameraMode(next);
        state.settings.camera = next;
    };
    const skip = () => {
        if (race.phase === 'finished') return;
        simulateToEnd(race);
    };

    const onKeyDown = (e) => {
        if (session.done) return;
        if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) nitroDown(); }
        else if (e.key === '1') setPace('save');
        else if (e.key === '2') setPace('race');
        else if (e.key === '3') setPace('push');
        else if (e.key === 'c' || e.key === 'C') toggleCamera();
        else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
    };
    const onKeyUp = (e) => { if (e.code === 'Space') nitroUp(); };
    const onClick = (e) => {
        const btn = e.target.closest('[data-race]');
        if (!btn) return;
        const kind = btn.dataset.race;
        if (kind === 'pace') setPace(btn.dataset.pace);
        else if (kind === 'speed') setSpeed(Number(btn.dataset.v));
        else if (kind === 'camera') toggleCamera();
        else if (kind === 'pause') togglePause();
        else if (kind === 'skip') skip();
        else if (kind === 'continue') finish();
    };
    const nitroBtn = $('rh-nitro-btn');
    const press = (e) => { e.preventDefault(); nitroDown(); };
    nitroBtn.addEventListener('pointerdown', press);
    nitroBtn.addEventListener('pointerup', nitroUp);
    nitroBtn.addEventListener('pointerleave', nitroUp);
    nitroBtn.addEventListener('pointercancel', nitroUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', view.resize);
    root.addEventListener('click', onClick);

    const el = {
        pos: $('rh-pos'), lap: $('rh-lap'), time: $('rh-time'), last: $('rh-last'), gap: $('rh-gap'),
        speed: $('rh-speed'), gear: $('rh-gear'), rpm: $('rh-rpm'), tyre: $('rh-tyre'), tyreN: $('rh-tyre-n'),
        nitro: $('rh-nitro'), nitroN: $('rh-nitro-n'), center: $('rh-center'), lights: $('rh-lights'), tip: $('rh-tip'), feed: $('rh-feed')
    };

    function updateHud() {
        el.pos.textContent = `${player.position}/${race.cars.length}`;
        el.lap.textContent = `${Math.min(race.laps, player.lap + 1)}/${race.laps}`;
        el.time.textContent = fmtTime(Math.max(0.001, race.time));
        el.last.textContent = player.lastLap ? fmtTime(player.lastLap) : '--';
        el.gap.textContent = player.position === 1 ? 'LEAD' : `+${player.gapAhead.toFixed(1)}s`;
        el.speed.textContent = Math.round(player.v * 3.6);
        el.gear.textContent = player.gear + 1;
        el.rpm.style.width = `${Math.min(100, (player.rpm / player.perf.redline) * 100)}%`;
        const tyre = Math.round((1 - player.tyreWear) * 100);
        el.tyre.style.width = `${tyre}%`;
        el.tyre.style.background = tyre > 45 ? 'var(--green)' : tyre > 20 ? 'var(--amber)' : 'var(--red)';
        el.tyreN.textContent = tyre;
        const nitro = Math.round(player.nitro * 100);
        el.nitro.style.width = `${nitro}%`;
        el.nitroN.textContent = nitro;
        nitroBtn.classList.toggle('active', player.nitroActive);
        nitroBtn.classList.toggle('empty', player.nitro <= 0);

        race.order.forEach((car, i) => {
            const r = rows.get(car.id);
            r.row.style.top = `${i * 26}px`;
            r.p.textContent = i + 1;
            r.g.textContent = i === 0 ? (car.finished ? 'FIN' : 'LEAD') : (car.finished ? 'FIN' : `+${car.gapAhead.toFixed(1)}`);
        });
    }

    function pumpFeed() {
        while (session.feedSeen < race.feed.length) {
            const item = race.feed[session.feedSeen++];
            const line = document.createElement('div');
            line.className = `feed-line ${item.type}`;
            line.textContent = item.text;
            el.feed.appendChild(line);
            while (el.feed.children.length > 4) el.feed.firstChild.remove();
            setTimeout(() => line.remove(), 5200);
            if (session.speed <= 2) {
                if (item.type === 'good') sfx.good();
                else if (item.type === 'bad') sfx.bad();
            }
        }
    }

    function updateStartSequence() {
        if (race.phase === 'countdown') {
            if (race.lightsOn !== session.lightsShown) {
                session.lightsShown = race.lightsOn;
                [...el.lights.children].forEach((light, i) => light.classList.toggle('on', i < race.lightsOn));
                if (race.lightsOn > 0) sfx.light();
            }
        } else if (!session.went) {
            session.went = true;
            [...el.lights.children].forEach(light => light.classList.remove('on'));
            el.tip.textContent = 'GO!';
            sfx.go();
            setTimeout(() => { el.center.innerHTML = ''; }, 900);
        }
    }

    function frame(now) {
        if (session.done) return;
        session.raf = requestAnimationFrame(frame);
        const dt = Math.min(0.1, (now - (session.last || now)) / 1000);
        session.last = now;

        if (!session.paused && race.phase !== 'finished') {
            // The start sequence always runs in real time.
            const speed = race.phase === 'countdown' ? 1 : session.speed;
            session.acc += dt * speed;
            let guard = 30;
            while (session.acc >= DT && guard-- > 0) {
                session.acc -= DT;
                stepRace(race);
                if (race.phase === 'racing') {
                    session.steps++;
                    if (race.input.pace === 'push') session.pushSteps++;
                }
                if (race.phase === 'finished') break;
                // Once the player is home, the rest of the field is resolved instantly.
                if (player.finished && !session.finishedShown) break;
            }
        }

        updateStartSequence();
        pumpFeed();
        updateHud();
        view.draw(dt);
        updateEngine(player.rpm / player.perf.redline, player.finished ? 0 : player.throttle, player.nitroActive, player.slide);

        if ((player.finished || race.phase === 'finished') && !session.finishedShown) {
            session.finishedShown = true;
            stopEngine();
            el.center.innerHTML = `<div class="big-msg">${player.position === 1 ? 'WINNER!' : `FINISHED ${ordinal(player.position).toUpperCase()}`}</div>`;
            if (player.position === 1) sfx.win();
            setTimeout(showResults, 1400);
        }
    }

    function showResults() {
        simulateToEnd(race);
        const table = classify(race);
        const summary = applyRaceResult(setup, table, {
            launchRating: race.launch.rating,
            pushShare: session.steps ? session.pushSteps / session.steps : 0,
            fastestLapId: race.fastestLap?.carId
        });
        session.summary = summary;
        const me = table.find(r => r.isPlayer);
        const rowsHtml = table.map(r => `
            <tr class="${r.isPlayer ? 'me' : ''}">
                <td class="num">${r.position}</td>
                <td><span class="swatch" style="background:${r.color}"></span>${esc(r.name)}</td>
                <td class="muted">${esc(r.carName)}</td>
                <td class="num">${r.position === 1 ? fmtTime(r.totalTime) : (r.lapsDown > 0 ? `+${r.lapsDown} lap` : `+${r.gap.toFixed(2)}s`)}</td>
                <td class="num">${fmtTime(r.bestLap)}${race.fastestLap?.carId === r.id ? ' <span class="warn">●</span>' : ''}</td>
            </tr>`).join('');
        const lines = [];
        summary.rewards.forEach(r => lines.push(`<div class="reward-line"><span>${esc(r.label)}</span><b class="good num">+${money(r.amount)}</b></div>`));
        summary.achievements.forEach(a => lines.push(`<div class="reward-line"><span>🏆 ${esc(a.name)}</span><b class="good num">${a.reward ? `+${money(a.reward)}` : 'Unlocked'}</b></div>`));
        lines.push(`<div class="reward-line"><span>Driver XP${summary.levelsGained ? ` — <b class="warn">LEVEL UP! Level ${state.level}, new skill point</b>` : ''}</span><b class="warn num">+${summary.xp} XP</b></div>`);
        if (summary.newRecord) lines.push(`<div class="reward-line"><span>⏱ New lap record</span><b class="num">${fmtTime(summary.newRecord.lap)}</b></div>`);
        if (summary.wear) lines.push(`<div class="reward-line"><span class="muted">Wear: engine -${summary.wear.engine.toFixed(1)}%, tyres -${summary.wear.tires.toFixed(1)}%, suspension -${summary.wear.suspension.toFixed(1)}%</span><span class="muted num">service ${money(summary.wear.serviceCost)}</span></div>`);
        const notes = [];
        if (summary.daily) notes.push(summary.eventCompleted ? `<p class="good">Daily Challenge complete. Streak: ${state.daily.streak} day${state.daily.streak > 1 ? 's' : ''}.</p>` : (summary.targetMet ? '' : `<p class="bad">Daily target missed: finish top ${summary.target}. You can try again.</p>`));
        else if (summary.eventCompleted) notes.push(`<p class="good">Target met (top ${summary.target}). Next event unlocked.</p>`);
        else if (!summary.targetMet) notes.push(`<p class="bad">Target missed: finish ${ordinal(summary.target)} or better to progress. Tune the car or change your race plan and try again.</p>`);
        if (summary.champion) notes.push(`<p class="warn"><b>🏆 You are the ${esc(summary.leagueName)} champion!</b></p>`);
        if (summary.unlockedLeague) notes.push(`<p class="warn"><b>New league unlocked: ${esc(summary.unlockedLeague.name)}.</b> Class ${summary.unlockedLeague.id} cars are now eligible.</p>`);
        if (summary.intel.length) notes.push(`<p class="muted">Rival intel: ${summary.intel.slice(0, 3).map(i => esc(i.text)).join(' ')}${summary.intel.length > 3 ? ` (+${summary.intel.length - 3} more in Rival Intel)` : ''}</p>`);
        if (race.launch.rating === 'perfect') notes.push('<p class="muted">Perfect launch off the line.</p>');

        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.innerHTML = `<div class="modal wide" role="dialog" aria-modal="true">
            <div class="spread">
                <div><div class="muted">${esc(summary.leagueName)} · ${esc(summary.eventName)}</div><h2>${me.position === 1 ? 'Victory' : me.position <= 3 ? 'Podium finish' : 'Race complete'}</h2>
                <div class="muted">Started ${ordinal(me.gridSlot)} · ${me.overtakes} overtake${me.overtakes === 1 ? '' : 's'} · top speed ${Math.round(me.topSpeedKmh)} km/h</div></div>
                <div class="result-pos ${me.position === 1 ? 'p1' : ''}">P${me.position}</div>
            </div>
            ${notes.join('')}
            <table class="standings"><thead><tr><th>#</th><th>Driver</th><th>Car</th><th>Time</th><th>Best lap</th></tr></thead><tbody>${rowsHtml}</tbody></table>
            <div>${lines.join('')}</div>
            <div class="spread"><b class="good num" style="font-size:20px">+${money(summary.totalMoney)}</b><button class="btn primary big" data-race="continue">Continue</button></div>
        </div>`;
        root.appendChild(overlay);
        overlay.querySelector('[data-race="continue"]').focus();
    }

    function finish() {
        if (session.done) return;
        session.done = true;
        cancelAnimationFrame(session.raf);
        stopEngine();
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('resize', view.resize);
        root.removeEventListener('click', onClick);
        root.hidden = true;
        root.innerHTML = '';
        active = null;
        onDone(session.summary);
    }

    startEngine();
    session.raf = requestAnimationFrame(frame);
    return session;
}

/** For automated tests and debugging from the console. */
export function getActiveRace() {
    return active;
}
