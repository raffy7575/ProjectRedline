// App shell: boots the game, draws the current screen and routes every click.

import { state, loadState, subscribe, commit, resetState, exportSave, importSave } from '../core/store.js';
import { LEAGUES, findEvent } from '../data/leagues.js';
import * as garage from '../game/garage.js';
import { buildRaceSetup, checkEligibility, nextEvent, isLeagueUnlocked, highestUnlockedTier } from '../game/career.js';
import { getDailyChallenge } from '../game/daily.js';
import { getSpecialOffers, msUntilNextWindow } from '../game/dealer.js';
import { upgradeSkill, checkStatAchievements } from '../game/progression.js';
import { getCarSpec, carSellValue } from '../game/performance.js';
import { sfx, setSoundEnabled } from '../audio/audio.js';
import { renderHeader, renderCareer, renderGarage, renderDealer, renderTuning, renderDriver } from './screens.js';
import { startRace, isRaceRunning } from './raceScreen.js';
import { esc, money, fmtTime, toast, openModal, closeModal } from './dom.js';

const ui = { tab: 'career', leagueTab: 'D', pendingSetup: null };
const SCREENS = { career: renderCareer, garage: renderGarage, dealer: renderDealer, tuning: renderTuning, driver: renderDriver };

function render() {
    if (isRaceRunning()) return;
    const app = document.getElementById('app');
    const scrollY = window.scrollY;
    app.innerHTML = renderHeader(ui.tab) + SCREENS[ui.tab](ui);
    window.scrollTo(0, scrollY);
}

function report(result, okText) {
    if (result.ok) {
        if (okText) toast(okText, 'good');
        sfx.buy();
    } else {
        toast(result.reason, 'bad');
        sfx.error();
    }
    return result.ok;
}

function announce(achievements) {
    achievements.forEach(a => toast(`🏆 ${a.name}${a.reward ? ` (+${money(a.reward)})` : ''}`, 'gold', 5000));
}

// ── Modals ───────────────────────────────────────────────────────────────────

function askName(onDone) {
    openModal(`<h2>Welcome to Project Redline</h2>
        <p class="muted">Build a car, climb four street racing leagues, and call the shots in every race: when to push, when to save your tyres, when to hit the nitro.</p>
        <label for="name-input">Driver name</label>
        <input type="text" id="name-input" maxlength="24" value="${esc(state.name === 'Driver' ? '' : state.name)}" placeholder="Your name" autocomplete="off">
        <button class="btn primary big" data-action="name-ok">Start career</button>`, { dismissable: false });
    ui.onName = onDone;
}

const HOW_TO = `<div class="howto">
    <div><kbd>SPACE</kbd><span><b>Launch:</b> hit it the instant the five red lights go out. Too early is a jump start.</span></div>
    <div><kbd>SPACE</kbd><span><b>Nitro:</b> hold on the straights. It does not refill, so spend it where it counts. Slipstreaming a rival adds a little back.</span></div>
    <div><kbd>1 2 3</kbd><span><b>Pace:</b> Save looks after the tyres, Push is faster but burns them and risks lock-ups. Worn tyres fall off a cliff.</span></div>
    <div><kbd>C</kbd><span>Switch between chase camera and full-track view. <kbd>P</kbd> pauses.</span></div>
</div>`;

function showGrid(setup) {
    ui.pendingSetup = setup;
    const me = setup.entries.find(e => e.isPlayer);
    const slots = setup.entries.map((e, i) => `<div class="grid-slot ${e.isPlayer ? 'me' : ''}">
        <b class="num">P${i + 1}</b>
        <div><span class="swatch" style="background:${e.color}"></span>${esc(e.name)}${e.tuned ? ' <span class="badge gold">TUNED</span>' : ''}<small>${esc(e.carName)}</small></div>
        <span class="num muted">${fmtTime(e.qualiTime)}</span>
    </div>`).join('');
    openModal(`<div class="spread"><div><div class="muted">${esc(setup.league.name)}${setup.daily ? ' · Daily Challenge' : ''}</div><h2>${esc(setup.event.name)}</h2>
        <div class="muted">${esc(setup.track.name)} · ${setup.laps} laps · ${(setup.track.length / 1000).toFixed(2)} km${setup.track.dirtShare > 0.05 ? ` · ${Math.round(setup.track.dirtShare * 100)}% dirt` : ''}</div></div>
        <div style="text-align:right"><div class="muted">You qualified</div><div class="result-pos" style="font-size:44px">P${me.gridSlot}</div></div></div>
        <div class="grid-list">${slots}</div>
        ${setup.bounty ? `<p><span class="badge gold">BOUNTY</span> Finish ahead of <b>${esc(setup.bounty.name)}</b> for an extra ${money(setup.bounty.amount)}.</p>` : ''}
        ${state.flags.seenHowTo ? '' : HOW_TO}
        <div class="spread"><button class="btn ghost" data-action="close-modal">Back</button>
        <div class="row">${state.flags.seenHowTo ? '<button class="btn ghost" data-action="how-to">How to race</button>' : ''}<button class="btn primary big" data-action="start-race">Start race</button></div></div>`, { wide: true });
}

function showSettings() {
    openModal(`<h2>Settings</h2>
        <label for="difficulty">Rival difficulty</label>
        <select id="difficulty" data-change="difficulty">${['easy', 'normal', 'hard'].map(d => `<option value="${d}" ${state.settings.difficulty === d ? 'selected' : ''}>${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}</select>
        <div class="row"><button class="btn" data-action="how-to">How to race</button><button class="btn" data-action="export-save">Export save</button><button class="btn" data-action="import-save">Import save</button></div>
        <p class="muted">Your progress is stored in this browser. Export a save to back it up or move it to another device.</p>
        <div class="spread"><button class="btn danger" data-action="reset-ask">Reset career</button><button class="btn primary" data-action="close-modal">Done</button></div>`);
}

// ── Actions ──────────────────────────────────────────────────────────────────

function enterRace(ctx) {
    const car = garage.getSelectedCar();
    if (!ctx.loanerModelId) {
        if (!car) return toast('Buy a car first.', 'bad');
        if (!checkEligibility(car, ctx.league).ok) return toast(`Your car is over the PI cap (${ctx.league.piCap}).`, 'bad');
    }
    showGrid(buildRaceSetup(ctx, car));
}

const actions = {
    'tab': (d) => { ui.tab = d.tab; sfx.click(); window.scrollTo(0, 0); render(); },
    'league-tab': (d) => { ui.leagueTab = d.league; sfx.click(); render(); },
    'close-modal': () => closeModal(),
    'name-ok': () => {
        const value = document.getElementById('name-input').value.trim().slice(0, 24) || 'Driver';
        closeModal();
        ui.onName?.(value);
    },
    'toggle-sound': () => {
        state.settings.sound = !state.settings.sound;
        setSoundEnabled(state.settings.sound);
        commit('settings');
    },
    'settings': () => showSettings(),
    'how-to': () => openModal(`<h2>How to race</h2>${HOW_TO}<button class="btn primary" data-action="close-modal">Got it</button>`),
    'export-save': () => {
        openModal(`<h2>Export save</h2><p class="muted">Copy this text somewhere safe.</p><textarea rows="8" readonly id="save-text">${esc(exportSave())}</textarea><button class="btn primary" data-action="close-modal">Done</button>`);
        document.getElementById('save-text').select();
    },
    'import-save': () => openModal(`<h2>Import save</h2><p class="muted">Paste a save exported from Project Redline. This replaces your current progress.</p><textarea rows="8" id="save-text"></textarea><div class="spread"><button class="btn ghost" data-action="close-modal">Cancel</button><button class="btn primary" data-action="import-ok">Import</button></div>`),
    'import-ok': () => {
        try {
            importSave(document.getElementById('save-text').value);
            closeModal();
            toast('Save imported.', 'good');
        } catch (error) {
            toast(error.message || 'That is not a valid save.', 'bad');
        }
    },
    'reset-ask': () => openModal(`<h2>Reset career?</h2><p>This deletes your cars, money and progress. It cannot be undone.</p><div class="spread"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="reset-ok">Delete everything</button></div>`),
    'reset-ok': () => {
        closeModal();
        resetState('Driver');
        ui.tab = 'career';
        ui.leagueTab = 'D';
        firstRun();
    },

    'buy-car': (d) => {
        if (report(garage.buyCar(d.model), 'Car delivered to your garage.')) {
            ui.tab = 'garage';
            announce(checkStatAchievements());
            commit('achievements');
        }
    },
    'buy-offer': (d) => {
        const offer = getSpecialOffers(highestUnlockedTier())[Number(d.offer)];
        if (offer && report(garage.buyOfferCar(offer), 'Limited edition delivered.')) {
            ui.tab = 'garage';
            announce(checkStatAchievements());
            commit('achievements');
        }
    },
    'select-car': (d) => { garage.selectCar(Number(d.uid)); sfx.click(); },
    'sell-car': (d) => {
        const car = garage.getCar(Number(d.uid));
        if (!car) return;
        openModal(`<h2>Sell ${esc(getCarSpec(car).name)}?</h2><p>You will receive <b class="good">${money(carSellValue(car))}</b>. Fitted parts are sold with the car.</p><div class="spread"><button class="btn" data-action="close-modal">Keep it</button><button class="btn primary" data-action="sell-ok" data-uid="${car.uid}">Sell</button></div>`);
    },
    'sell-ok': (d) => { closeModal(); report(garage.sellCar(Number(d.uid)), 'Car sold.'); },
    'paint': (d) => { const car = garage.getSelectedCar(); if (car) report(garage.paintCar(car.uid, d.color)); },
    'repair': (d) => { const car = garage.getSelectedCar(); if (car) report(garage.repair(car.uid, d.part), 'Serviced.'); },
    'buy-upgrade': (d) => {
        const car = garage.getSelectedCar();
        if (car && report(garage.buyUpgrade(car.uid, d.item), 'Part fitted.')) {
            announce(checkStatAchievements());
            commit('achievements');
        }
    },
    'equip': (d) => { const car = garage.getSelectedCar(); if (car) { garage.equipUpgrade(car.uid, d.cat, d.item || null); sfx.click(); } },
    'skill': (d) => { if (report(upgradeSkill(d.skill))) commit('skill'); },

    'enter-event': (d) => {
        const found = findEvent(d.event);
        if (found) enterRace({ league: found.league, event: found.event });
    },
    'enter-daily': () => {
        const daily = getDailyChallenge();
        enterRace({ league: daily.league, event: daily.event, daily: true, loanerModelId: daily.loanerModelId });
    },
    'start-race': () => {
        const setup = ui.pendingSetup;
        if (!setup) return;
        ui.pendingSetup = null;
        closeModal();
        if (!state.flags.seenHowTo) { state.flags.seenHowTo = true; commit('flags'); }
        document.getElementById('app').hidden = true;
        startRace(setup, (summary) => {
            document.getElementById('app').hidden = false;
            if (summary?.unlockedLeague) ui.leagueTab = summary.unlockedLeague.id;
            ui.tab = 'career';
            render();
            if (summary?.levelsGained) toast('Level up! Spend your skill point in the Driver tab.', 'gold', 5000);
        });
    }
};

function firstRun() {
    askName((name) => {
        state.name = name;
        ui.tab = 'dealer';
        commit('name');
        toast('Welcome! Pick your first car.', 'good', 5000);
    });
}

export function boot() {
    const status = loadState();
    setSoundEnabled(state.settings.sound);
    subscribe(render);

    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (target && !target.disabled) {
            const handler = actions[target.dataset.action];
            if (handler) handler(target.dataset, target);
            return;
        }
        if (e.target.dataset?.dismiss) closeModal();
    });
    document.addEventListener('change', (e) => {
        if (e.target.dataset?.change === 'difficulty') {
            state.settings.difficulty = e.target.value;
            commit('settings');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.id === 'name-input') actions['name-ok']();
        if (e.key === 'Escape' && !isRaceRunning() && document.querySelector('[data-dismiss]')) closeModal();
    });
    // Keep the special-offer countdown honest without re-rendering every second.
    setInterval(() => {
        const timer = document.getElementById('offer-timer');
        if (!timer) return;
        const ms = msUntilNextWindow();
        if (ms > 15 * 60 * 1000 - 1500) render();
        else timer.textContent = `New stock in ${Math.ceil(ms / 60000)} min`;
    }, 1000);

    const active = nextEvent();
    if (active && isLeagueUnlocked(active.league.id)) ui.leagueTab = active.league.id;
    else ui.leagueTab = LEAGUES.filter(l => isLeagueUnlocked(l.id)).pop()?.id || 'D';

    if (state.cars.length === 0) ui.tab = 'dealer';
    render();
    if (status === 'new') firstRun();
    else if (status === 'migrated') toast('Your old save was upgraded: name, money and starter cars carried over. The career starts fresh.', 'gold', 8000);
}
