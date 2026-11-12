// Rival economy. Rivals earn prize money and spend it on parts that suit their
// style, always staying under the league's PI cap. Their purchases show up in
// the Rival Intel feed so the player can see the grid getting faster.

import { state } from '../core/store.js';
import { CARS, CLASS_INFO } from '../data/cars.js';
import { UPGRADE_CATEGORIES, findUpgrade } from '../data/upgrades.js';
import { PRIZE_SPLIT } from '../data/leagues.js';
import { getRival, BIAS_PRIORITIES } from '../data/rivals.js';
import { applyEffects } from '../sim/vehicle.js';
import { specToPI } from './performance.js';

function rosterModel(league, rivalId) {
    const pair = league.roster.find(([id]) => id === rivalId);
    return pair ? CARS.find(c => c.id === pair[1]) : null;
}

/** Best legal set of effects from a rival's parts for a given surface. */
function loadoutEffects(items, dirtShare) {
    const best = {};
    items.forEach(id => {
        const found = findUpgrade(id);
        if (!found) return;
        const catId = found.category.id;
        if (catId === 'tyres') {
            const wantsGravel = dirtShare > 0.4;
            const isGravel = id === 'tir2';
            const current = best.tyres ? findUpgrade(best.tyres) : null;
            if (isGravel !== wantsGravel) return;
            if (!current || found.item.cost > current.item.cost) best.tyres = id;
        } else if (!best[catId] || found.stage > findUpgrade(best[catId]).stage) {
            best[catId] = id;
        }
    });
    return Object.values(best).map(id => findUpgrade(id).item.fx);
}

export function rivalTunedSpec(league, rivalId, dirtShare = 0) {
    const model = rosterModel(league, rivalId);
    const items = state.career.rivals[league.id]?.[rivalId]?.items || [];
    return applyEffects(model, loadoutEffects(items, dirtShare));
}

function nextItemFor(category, items, bias) {
    if (category.mode === 'choice') {
        const order = bias === 'offroad' ? ['tir2', 'tir3', 'tir1'] : ['tir3', 'tir1'];
        const id = order.find(candidate => !items.includes(candidate));
        return id ? findUpgrade(id).item : null;
    }
    return category.items.find(item => !items.includes(item.id)) || null;
}

/** Let one rival buy up to `maxBuys` parts. Returns the names of what they bought. */
function shop(league, rivalId, maxBuys) {
    const rival = getRival(rivalId);
    const model = rosterModel(league, rivalId);
    const wallet = state.career.rivals[league.id][rivalId];
    const costMul = CLASS_INFO[model.cls].upgradeCostMul;
    const bought = [];
    for (let n = 0; n < maxBuys; n++) {
        let purchase = null;
        for (const catId of BIAS_PRIORITIES[rival.bias] || BIAS_PRIORITIES.balanced) {
            const category = UPGRADE_CATEGORIES.find(c => c.id === catId);
            const item = nextItemFor(category, wallet.items, rival.bias);
            if (!item) continue;
            const cost = item.cost * costMul;
            if (cost > wallet.money) continue;
            const trial = [...wallet.items, item.id];
            if (specToPI(applyEffects(model, loadoutEffects(trial, 0))) > league.piCap) continue;
            purchase = { item, cost };
            break;
        }
        if (!purchase) break;
        wallet.money -= purchase.cost;
        wallet.items.push(purchase.item.id);
        bought.push(purchase.item.name);
    }
    return bought;
}

/** Create wallets the first time a league is entered; rivals arrive lightly tuned. */
export function ensureLeagueRivals(league) {
    if (!state.career.rivals[league.id]) state.career.rivals[league.id] = {};
    const wallets = state.career.rivals[league.id];
    league.roster.forEach(([rivalId, modelId]) => {
        if (wallets[rivalId]) return;
        const model = CARS.find(c => c.id === modelId);
        const rival = getRival(rivalId);
        wallets[rivalId] = { money: Math.round(1400 * CLASS_INFO[model.cls].upgradeCostMul * (1 + rival.talent * 30)), items: [] };
        shop(league, rivalId, 2);
    });
}

const INTEL_LINES = {
    power: (name, part) => `${name} bolted on a ${part}.`,
    grip: (name, part) => `${name} found grip with a ${part}.`,
    offroad: (name, part) => `${name} fitted a ${part} for the rough stuff.`,
    balanced: (name, part) => `${name} upgraded to a ${part}.`
};

/** After a first-time event: pay rivals by finishing position, then let them shop. */
export function payAndShopRivals(league, event, classification) {
    ensureLeagueRivals(league);
    const feed = [];
    classification.forEach(result => {
        if (result.isPlayer) return;
        const wallet = state.career.rivals[league.id][result.id];
        if (!wallet) return;
        wallet.money += Math.round(event.prize * (PRIZE_SPLIT[result.position - 1] || 0.05));
        const rival = getRival(result.id);
        shop(league, result.id, 1).forEach(part => {
            const line = (INTEL_LINES[rival.bias] || INTEL_LINES.balanced)(rival.name.split(' ')[0], part);
            feed.push({ leagueId: league.id, rivalId: result.id, text: line });
        });
    });
    state.career.intel.push(...feed);
    state.career.intel = state.career.intel.slice(-30);
    return feed;
}
