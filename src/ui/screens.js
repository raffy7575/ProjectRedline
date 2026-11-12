// HTML for every non-race screen. Each function returns a string; clicks are
// handled centrally in app.js through data-action attributes.

import { state } from '../core/store.js';
import { CARS, CAR_CLASSES, CLASS_INFO, PAINT_COLORS } from '../data/cars.js';
import { LEAGUES } from '../data/leagues.js';
import { getTrackDef } from '../data/tracks.js';
import { SKILLS, SKILL_MAX, ACHIEVEMENTS, MAX_LEVEL } from '../data/progression.js';
import { buildTrack, trackSvgPath } from '../sim/track.js';
import { applyEffects, derivePerf, headlineStats, ratingBars } from '../sim/vehicle.js';
import { getCarSpec, getCarPI, getTunedSpec, specToPI, classForPI, upgradeCost, carSellValue, UPGRADE_CATEGORIES } from '../game/performance.js';
import { getSelectedCar, carDisplayColor, repairCost, fullServiceCost } from '../game/garage.js';
import {
    isLeagueUnlocked, isEventUnlocked, isEventCompleted, eventBestPosition, getStandings, checkEligibility,
    nextEvent, isFeatureUnlocked, highestUnlockedTier, trackKey
} from '../game/career.js';
import { getDailyChallenge, isDailyDone, currentDailyStreak } from '../game/daily.js';
import { getSpecialOffers, msUntilNextWindow } from '../game/dealer.js';
import { skillLevel, availableSkillPoints, levelProgress } from '../game/progression.js';
import { carSvg } from './carArt.js';
import { esc, money, fmtTime, ordinal } from './dom.js';

const trackCache = new Map();
function trackFor(event) {
    const key = trackKey(event.trackId, event.reverse);
    if (!trackCache.has(key)) trackCache.set(key, buildTrack(getTrackDef(event.trackId), { reverse: !!event.reverse }));
    return trackCache.get(key);
}

function trackMap(event) {
    const { d, startX, startY } = trackSvgPath(trackFor(event));
    return `<svg class="trackmap" viewBox="0 0 100 100" aria-hidden="true"><path d="${d}"/><circle cx="${startX.toFixed(1)}" cy="${startY.toFixed(1)}" r="4"/></svg>`;
}

function piBadge(pi) {
    const cls = classForPI(pi);
    const color = CLASS_INFO[cls]?.color || '#d7b8ff';
    return `<span class="badge pi" style="background:${color}">${cls} ${pi}</span>`;
}

function eventMeta(event) {
    const track = trackFor(event);
    const surface = track.dirtShare > 0.05 ? `${Math.round(track.dirtShare * 100)}% dirt` : 'tarmac';
    return `${esc(track.name)} · ${event.laps} laps · ${(track.length / 1000).toFixed(2)} km · ${surface}`;
}

function statBars(spec, previewSpec) {
    const bars = ratingBars(derivePerf(spec));
    const next = previewSpec ? ratingBars(derivePerf(previewSpec)) : null;
    const labels = { speed: 'Top speed', accel: 'Accel', handling: 'Handling', braking: 'Braking', dirt: 'Dirt' };
    return Object.keys(labels).map(key => {
        const gain = next ? next[key] - bars[key] : 0;
        return `<div class="stat-row"><span>${labels[key]}</span><div class="bar"><i style="width:${bars[key]}%"></i>${gain > 0 ? `<i class="gain" style="left:${bars[key]}%;width:${gain}%"></i>` : ''}</div><b>${next ? next[key] : bars[key]}</b></div>`;
    }).join('');
}

function specFacts(spec) {
    const h = headlineStats(derivePerf(spec));
    return `<div class="kv">
        <div><small>Power</small><b>${Math.round(spec.hp)} hp</b></div>
        <div><small>Weight</small><b>${Math.round(spec.weight)} kg</b></div>
        <div><small>0-100</small><b>${h.zeroToHundred.toFixed(1)} s</b></div>
        <div><small>Top speed</small><b>${Math.round(h.topSpeedKmh)} km/h</b></div>
        <div><small>Drive</small><b>${spec.drivetrain}</b></div>
    </div>`;
}

// ── Header ───────────────────────────────────────────────────────────────────

export function renderHeader(tab) {
    const lp = levelProgress();
    const points = availableSkillPoints();
    const tabs = [['career', 'Career'], ['garage', 'Garage'], ['dealer', 'Dealer'], ['tuning', 'Tuning'], ['driver', 'Driver']];
    return `<header class="topbar">
        <div class="logo"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1c1f26"/><path d="M6 22 14 8h6l-4 7h6L12 26l2-7H9z" fill="#ff3b2f"/></svg><b>PROJECT <span>REDLINE</span></b></div>
        <nav class="nav" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${tab === id}" class="${tab === id ? 'active' : ''}" data-action="tab" data-tab="${id}">${label}${id === 'driver' && points > 0 ? '<i class="dot" title="Skill points available"></i>' : ''}</button>`).join('')}</nav>
        <div class="hud-chips">
            <div class="chip level-chip" title="${lp.xp} / ${lp.need} XP"><b>LV ${state.level}</b><div class="xpbar"><i style="width:${Math.round(lp.fraction * 100)}%"></i></div></div>
            <div class="chip money num" id="money-chip">${money(state.money)}</div>
            <button class="icon-btn" data-action="toggle-sound" title="Sound on/off" aria-label="Toggle sound">${state.settings.sound ? '🔊' : '🔇'}</button>
            <button class="icon-btn" data-action="settings" title="Settings" aria-label="Settings">⚙</button>
        </div>
    </header>`;
}

// ── Career ───────────────────────────────────────────────────────────────────

function eligibilityBadges(car, league) {
    const result = checkEligibility(car, league);
    return result.checks.map(c => `<span class="badge ${c.pass ? 'ok' : 'no'}">${c.pass ? '✓' : '✕'} ${esc(c.label)}</span>`).join(' ');
}

function heroCard(car) {
    const next = nextEvent();
    if (!next) {
        return `<div class="panel hero"><div style="font-size:64px;text-align:center">🏆</div><div><h3>Career complete</h3><p class="meta">You have beaten every league. Replay events to chase lap records and championships, or take on the Daily Challenge.</p></div></div>`;
    }
    const { league, event } = next;
    const ok = car && checkEligibility(car, league).ok;
    const record = state.records[trackKey(event.trackId, event.reverse)];
    return `<div class="panel hero">
        ${trackMap(event)}
        <div>
            <div class="muted">NEXT RACE · ${esc(league.name)}</div>
            <h3>${esc(event.name)}</h3>
            <p class="meta">${eventMeta(event)}</p>
            <div class="row" style="margin-bottom:12px">
                <span class="badge gold">Win ${money(event.prize)}</span>
                <span class="badge">Target: top ${event.target}</span>
                ${record ? `<span class="badge">Your record ${fmtTime(record.lap)}</span>` : ''}
                ${car ? eligibilityBadges(car, league) : ''}
            </div>
            <div class="row">
                <button class="btn primary big" data-action="enter-event" data-event="${event.id}" ${ok ? '' : 'disabled'}>RACE</button>
                ${!car ? '<span class="warn">Buy a car at the Dealer first.</span>' : (!ok ? '<span class="warn">Car is over the PI cap: detune it in Tuning or pick another car.</span>' : '')}
            </div>
        </div>
    </div>`;
}

function dailyCard(car) {
    const daily = getDailyChallenge();
    const done = isDailyDone();
    const streak = currentDailyStreak();
    const ok = daily.loanerModelId || (car && checkEligibility(car, daily.league).ok);
    return `<div class="panel daily">
        <div class="spread">
            <div>
                <div class="warn" style="font-weight:800;letter-spacing:.1em;font-size:12px">DAILY CHALLENGE${streak ? ` · ${streak}-DAY STREAK 🔥` : ''}</div>
                <h3 style="font-size:18px">${esc(daily.event.name)}</h3>
                <div class="muted">${eventMeta(daily.event)}</div>
                <div class="muted">${daily.loanerModelId ? `Everyone drives a stock <b>${esc(daily.loanerName)}</b>: no tuning, just driving.` : `Bring your own car (max PI ${daily.league.piCap}).`} Finish top 3 for ${money(daily.event.prize)}.</div>
            </div>
            <button class="btn ${done ? '' : 'primary'}" data-action="enter-daily" ${done || !ok ? 'disabled' : ''}>${done ? 'Done ✓ back tomorrow' : 'Start'}</button>
        </div>
    </div>`;
}

function eventRow(league, event, index, car) {
    const unlocked = isEventUnlocked(league, index);
    const done = isEventCompleted(event);
    const best = eventBestPosition(event.id);
    const ok = car && checkEligibility(car, league).ok;
    return `<div class="event ${unlocked ? '' : 'locked'} ${done ? 'done' : ''}">
        ${trackMap(event)}
        <div>
            <h4>${esc(event.name)} ${done ? '<span class="badge ok">✓</span>' : ''}</h4>
            <div class="sub">${eventMeta(event)}</div>
            <div class="sub">Target top ${event.target}${best ? ` · best finish ${ordinal(best)}` : ''}</div>
        </div>
        <div class="right">
            <b class="good num">${money(done ? event.prize * 0.5 : event.prize)}</b>
            <button class="btn small ${done ? '' : 'primary'}" data-action="enter-event" data-event="${event.id}" ${unlocked && ok ? '' : 'disabled'}>${!unlocked ? '🔒 Locked' : done ? 'Replay' : 'Race'}</button>
        </div>
    </div>`;
}

export function renderCareer(ui) {
    const car = getSelectedCar();
    const league = LEAGUES.find(l => l.id === ui.leagueTab) || LEAGUES[0];
    const unlocked = isLeagueUnlocked(league.id);
    const standings = getStandings(league.id);
    const intel = state.career.intel.filter(i => i.leagueId === league.id).slice(-5).reverse();
    const spec = car ? getTunedSpec(car) : null;

    return `<main class="screen">
        <div class="cols">
            <div class="stack">
                ${heroCard(car)}
                ${dailyCard(car)}
                <div class="panel">
                    <h2>Leagues</h2>
                    <div class="league-tabs">${LEAGUES.map(l => `<button data-action="league-tab" data-league="${l.id}" class="${l.id === league.id ? 'active' : ''} ${isLeagueUnlocked(l.id) ? '' : 'locked'}">${isLeagueUnlocked(l.id) ? '' : '🔒 '}${esc(l.name)}${state.career.champions[l.id] ? ' 🏆' : ''}</button>`).join('')}</div>
                    <p class="muted" style="margin-bottom:10px">${esc(league.description)} PI cap <b>${league.piCap}</b>. Champion bonus <b>${money(league.championBonus)}</b>.</p>
                    ${unlocked ? league.events.map((e, i) => eventRow(league, e, i, car)).join('') : `<div class="empty">Complete every event in the previous league to unlock ${esc(league.name)}.</div>`}
                </div>
            </div>
            <div class="stack">
                <div class="panel">
                    <h2>Your car</h2>
                    ${car ? `<div class="spread"><h3>${esc(spec.name)}</h3>${piBadge(getCarPI(car))}</div>${carSvg(spec.body, carDisplayColor(car))}
                    <div class="stack" style="gap:6px">${statBars(spec)}</div>
                    <div class="row" style="margin-top:12px"><button class="btn small" data-action="tab" data-tab="tuning">Tune</button><button class="btn small" data-action="tab" data-tab="garage">Garage</button></div>`
        : '<div class="empty">No car yet. Head to the Dealer and pick your first ride.</div><div class="row" style="margin-top:12px"><button class="btn primary" data-action="tab" data-tab="dealer">Go to Dealer</button></div>'}
                </div>
                <div class="panel">
                    <h2>Championship · ${esc(league.name)}</h2>
                    <table class="standings"><thead><tr><th>#</th><th>Driver</th><th>Pts</th><th>Wins</th><th>Pod</th></tr></thead><tbody>
                    ${standings.map((r, i) => `<tr class="${r.isPlayer ? 'me' : ''}"><td class="num">${i + 1}</td><td><span class="swatch" style="background:${r.isPlayer ? '#ff3b2f' : r.color}"></span>${esc(r.name)}</td><td class="num">${r.points}</td><td class="num">${r.wins}</td><td class="num">${r.podiums}</td></tr>`).join('')}
                    </tbody></table>
                </div>
                ${isFeatureUnlocked('rivalIntel') ? `<div class="panel"><h2>Rival intel</h2>${intel.length ? `<ul class="intel">${intel.map(i => `<li>${esc(i.text)}</li>`).join('')}</ul>` : '<p class="muted">Nothing yet. Rivals spend their prize money on parts after each new event.</p>'}</div>` : ''}
            </div>
        </div>
    </main>`;
}

// ── Garage ───────────────────────────────────────────────────────────────────

export function renderGarage() {
    const car = getSelectedCar();
    if (!car) {
        return `<main class="screen"><div class="empty">Your garage is empty. <button class="btn primary" data-action="tab" data-tab="dealer">Visit the Dealer</button></div></main>`;
    }
    const spec = getTunedSpec(car);
    const color = carDisplayColor(car);
    const maintenance = isFeatureUnlocked('maintenance');
    const parts = [['engine', 'Engine'], ['tires', 'Tyres'], ['suspension', 'Suspension']];
    const service = fullServiceCost(car);

    return `<main class="screen"><div class="cols side">
        <div class="panel">
            <h2>My cars (${state.cars.length})</h2>
            <div class="stack" style="gap:8px">${state.cars.map(c => {
        const s = getCarSpec(c);
        return `<button class="car-card ${c.uid === car.uid ? 'selected' : ''}" data-action="select-car" data-uid="${c.uid}">
                    <div class="spread"><h4>${esc(s.name)}</h4>${piBadge(getCarPI(c))}</div>
                    ${carSvg(s.body, carDisplayColor(c))}
                    <div class="muted" style="font-size:12px">${c.races} races · ${c.wins} wins</div>
                </button>`;
    }).join('')}</div>
        </div>
        <div class="stack">
            <div class="panel">
                <div class="spread"><div><h3 style="font-size:22px">${esc(spec.name)}</h3><div class="muted">${esc(getCarSpec(car).blurb || '')}</div></div>${piBadge(getCarPI(car))}</div>
                <div style="max-width:520px;margin:6px auto">${carSvg(spec.body, color)}</div>
                ${specFacts(spec)}
                <div class="stack" style="gap:6px;margin-top:12px">${statBars(spec)}</div>
                <div class="row" style="margin-top:14px">
                    <button class="btn primary" data-action="tab" data-tab="tuning">Tune this car</button>
                    <button class="btn danger" data-action="sell-car" data-uid="${car.uid}" ${state.cars.length <= 1 ? 'disabled title="You cannot sell your only car"' : ''}>Sell for ${money(carSellValue(car))}</button>
                </div>
            </div>
            <div class="panel">
                <h2>Paint · ${money(250)}</h2>
                <div class="swatches">${PAINT_COLORS.map(c => `<button style="background:${c}" class="${c === color ? 'on' : ''}" data-action="paint" data-color="${c}" aria-label="Paint ${c}"></button>`).join('')}</div>
            </div>
            <div class="panel">
                <h2>Condition</h2>
                ${maintenance ? `${parts.map(([key, label]) => {
        const pct = Math.round(car.condition[key]);
        const cost = repairCost(car, key);
        return `<div class="cond-row"><span>${label}</span><div class="bar"><i style="width:${pct}%;background:${pct > 70 ? 'var(--green)' : pct > 40 ? 'var(--amber)' : 'var(--red)'}"></i></div><b class="num">${pct}%</b><button class="btn small" data-action="repair" data-part="${key}" ${cost <= 0 || state.money < cost ? 'disabled' : ''}>${cost > 0 ? money(cost) : 'OK'}</button></div>`;
    }).join('')}
                <div class="spread" style="margin-top:10px"><span class="muted">Worn parts cost power and grip in every race.</span><button class="btn" data-action="repair" data-part="all" ${service <= 0 || state.money < service ? 'disabled' : ''}>Full service ${service > 0 ? money(service) : ''}</button></div>`
        : '<p class="muted">Wear and maintenance begin in the Semi-Pro League. For now your car stays factory fresh.</p>'}
            </div>
        </div>
    </div></main>`;
}

// ── Dealer ───────────────────────────────────────────────────────────────────

function dealerCard(spec, price, action, sold = false) {
    const tier = CAR_CLASSES.indexOf(spec.cls) + 1;
    const classLocked = tier > highestUnlockedTier();
    const pi = specToPI(applyEffects(spec, []));
    return `<div class="car-card ${classLocked ? 'locked' : ''}">
        <div class="spread"><h4>${esc(spec.name)}</h4>${piBadge(pi)}</div>
        ${carSvg(spec.body, spec.color)}
        <div class="blurb">${esc(spec.blurb || '')}</div>
        <div class="muted num" style="font-size:12px">${Math.round(spec.hp)} hp · ${spec.weight} kg · ${spec.drivetrain}</div>
        <div class="stack" style="gap:5px">${statBars(applyEffects(spec, []))}</div>
        <button class="btn ${!sold && state.money >= price ? 'primary' : ''}" ${action} ${sold || state.money < price ? 'disabled' : ''}>${sold ? 'Sold' : `Buy ${money(price)}`}</button>
        ${classLocked ? `<div class="muted" style="font-size:11px">Too fast for your current league (PI cap). Buy it when you reach ${CLASS_INFO[spec.cls].label}.</div>` : ''}
    </div>`;
}

export function renderDealer() {
    const offersUnlocked = isFeatureUnlocked('specialOffers');
    const offers = offersUnlocked ? getSpecialOffers(highestUnlockedTier()) : [];
    const mins = Math.ceil(msUntilNextWindow() / 60000);
    return `<main class="screen">
        ${state.cars.length === 0 ? '<div class="panel daily"><h3>Pick your first car</h3><p class="muted">You have enough for one Class D starter. Each has a different strength: corners, straights or dirt. You can buy the others later.</p></div>' : ''}
        ${CAR_CLASSES.map(cls => `<div class="panel"><h2>${CLASS_INFO[cls].label} · PI up to ${CLASS_INFO[cls].piCap}</h2><div class="grid-cards">${CARS.filter(c => c.cls === cls).map(c => dealerCard(c, c.price, `data-action="buy-car" data-model="${c.id}"`)).join('')}</div></div>`).join('')}
        <div class="panel">
            <div class="spread"><h2>Special offers</h2>${offersUnlocked ? `<span class="muted num" id="offer-timer">New stock in ${mins} min</span>` : ''}</div>
            ${offersUnlocked ? `<div class="grid-cards">${offers.map((o, i) => dealerCard(o.spec, o.price, `data-action="buy-offer" data-offer="${i}"`, o.sold)).join('')}</div>` : '<div class="empty">🔒 Limited editions unlock when you reach the Semi-Pro League.</div>'}
        </div>
    </main>`;
}

// ── Tuning ───────────────────────────────────────────────────────────────────

export function renderTuning() {
    const car = getSelectedCar();
    if (!car) return `<main class="screen"><div class="empty">Buy a car first.</div></main>`;
    const spec = getTunedSpec(car);
    const pi = getCarPI(car);
    const league = LEAGUES.filter(l => isLeagueUnlocked(l.id)).sort((a, b) => b.tier - a.tier)[0];
    const fitting = LEAGUES.find(l => pi <= l.piCap);

    const cats = UPGRADE_CATEGORIES.map(cat => {
        const equippedId = car.equipped[cat.id] || null;
        const stock = cat.mode === 'staged'
            ? `<button class="pill ${equippedId ? '' : 'on'}" data-action="equip" data-cat="${cat.id}" data-item="">Stock<small>${equippedId ? 'Fit' : 'Fitted'}</small></button>` : '';
        const pills = cat.items.map((item, stage) => {
            const free = item.cost === 0;
            const owned = free || car.owned.includes(item.id);
            const on = free ? !equippedId : equippedId === item.id;
            const cost = upgradeCost(car, item);
            const needsPrev = cat.mode === 'staged' && stage > 0 && !car.owned.includes(cat.items[stage - 1].id);
            const trial = { ...car.equipped, [cat.id]: item.id };
            if (free) delete trial[cat.id];
            const delta = getCarPI(car, trial) - pi;
            const deltaText = on ? '' : ` · PI ${delta >= 0 ? '+' : ''}${delta}`;
            if (owned) return `<button class="pill ${on ? 'on' : ''}" data-action="equip" data-cat="${cat.id}" data-item="${free ? '' : item.id}">${esc(item.name)}<small>${on ? 'Fitted' : `Fit${deltaText}`}</small></button>`;
            return `<button class="pill buy" data-action="buy-upgrade" data-item="${item.id}" ${needsPrev || state.money < cost ? 'disabled' : ''} title="${needsPrev ? 'Buy the previous stage first' : ''}">${esc(item.name)}<small>${money(cost)}${deltaText}</small></button>`;
        }).join('');
        return `<div class="tune-cat"><h4>${cat.icon} ${esc(cat.name)}</h4><div class="pills">${stock}${pills}</div></div>`;
    }).join('');

    return `<main class="screen"><div class="cols side">
        <div class="stack">
            <div class="panel">
                <h2>${esc(spec.name)}</h2>
                ${carSvg(spec.body, carDisplayColor(car))}
                <div class="pi-meter"><span class="big" style="color:${CLASS_INFO[classForPI(pi)]?.color || '#d7b8ff'}">${pi}</span><span class="muted">Performance Index</span></div>
                <div class="bar" style="margin:8px 0"><i style="width:${Math.min(100, (pi / league.piCap) * 100)}%;background:${pi > league.piCap ? 'var(--red)' : 'var(--green)'}"></i></div>
                <p class="${pi > league.piCap ? 'bad' : 'muted'}">${pi > league.piCap ? `Over the ${league.name} cap (${league.piCap}). Unfit a part to race there.` : `${league.piCap - pi} PI of headroom in the ${league.name} (cap ${league.piCap}).`}${fitting && fitting.id !== league.id ? ` Legal for ${fitting.name} and above.` : ''}</p>
            </div>
            <div class="panel">${specFacts(spec)}<div class="stack" style="gap:6px;margin-top:12px">${statBars(spec)}</div></div>
            <div class="panel"><p class="muted">PI is measured, not guessed: the game laps your exact build on a reference circuit. Parts you own can be fitted or removed for free, so one car can serve several leagues. Gearbox and nitrous parts add no PI at all, and gravel tyres transform dirt events.</p></div>
        </div>
        <div class="panel"><h2>Parts</h2>${cats}</div>
    </div></main>`;
}

// ── Driver ───────────────────────────────────────────────────────────────────

export function renderDriver() {
    const lp = levelProgress();
    const points = availableSkillPoints();
    const s = state.stats;
    const records = Object.entries(state.records);
    return `<main class="screen"><div class="cols even">
        <div class="stack">
            <div class="panel">
                <div class="spread"><div><h3 style="font-size:22px">${esc(state.name)}</h3><div class="muted">Driver level ${state.level}${state.level >= MAX_LEVEL ? ' (max)' : ''}</div></div><span class="badge gold">${points} skill point${points === 1 ? '' : 's'}</span></div>
                <div class="bar" style="margin:10px 0 4px"><i style="width:${Math.round(lp.fraction * 100)}%;background:var(--amber)"></i></div>
                <div class="muted num">${lp.xp} / ${lp.need} XP to next level. Every level gives one skill point.</div>
            </div>
            <div class="panel"><h2>Skills</h2><div class="stack" style="gap:8px">${SKILLS.map(skill => {
        const lvl = skillLevel(skill.id);
        return `<div class="skill"><div class="ico">${skill.icon}</div><div><b>${esc(skill.name)}</b><div class="muted" style="font-size:12px">${esc(skill.desc)} <span class="warn">${esc(skill.effect)}</span></div><div class="pips">${Array.from({ length: SKILL_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div><button class="btn small ${points > 0 && lvl < SKILL_MAX ? 'primary' : ''}" data-action="skill" data-skill="${skill.id}" ${points <= 0 || lvl >= SKILL_MAX ? 'disabled' : ''}>${lvl >= SKILL_MAX ? 'MAX' : 'Upgrade'}</button></div>`;
    }).join('')}</div></div>
        </div>
        <div class="stack">
            <div class="panel"><h2>Career stats</h2><div class="kv">
                <div><small>Races</small><b>${s.races}</b></div><div><small>Wins</small><b>${s.wins}</b></div><div><small>Podiums</small><b>${s.podiums}</b></div>
                <div><small>Overtakes</small><b>${s.overtakes}</b></div><div><small>Distance</small><b>${s.distanceKm.toFixed(0)} km</b></div><div><small>Earnings</small><b>${money(s.earnings)}</b></div>
                <div><small>Best streak</small><b>${s.bestWinStreak}</b></div><div><small>Perfect starts</small><b>${s.perfectLaunches}</b></div>
            </div></div>
            <div class="panel"><h2>Lap records</h2>${records.length ? `<table class="standings"><tbody>${records.map(([key, r]) => {
        const [trackId, rev] = key.split(':');
        return `<tr><td>${esc(getTrackDef(trackId)?.name || trackId)}${rev ? ' (Reverse)' : ''}</td><td class="num">${fmtTime(r.lap)}</td><td class="muted">${esc(r.carName)}</td></tr>`;
    }).join('')}</tbody></table>` : '<p class="muted">Set a flying lap in any race to start your record book.</p>'}</div>
            <div class="panel"><h2>Achievements (${Object.keys(state.achievements).length}/${ACHIEVEMENTS.length})</h2><div class="stack" style="gap:6px">${ACHIEVEMENTS.map(a => `<div class="ach ${state.achievements[a.id] ? 'on' : ''}"><span>${state.achievements[a.id] ? '🏆' : '○'}</span><div><b>${esc(a.name)}</b><div class="muted" style="font-size:12px">${esc(a.desc)}</div></div><span class="num ${state.achievements[a.id] ? 'good' : 'muted'}">${a.reward ? money(a.reward) : ''}</span></div>`).join('')}</div></div>
        </div>
    </div></main>`;
}
