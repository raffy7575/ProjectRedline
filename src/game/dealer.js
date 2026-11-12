// Special offers: limited "factory tuned" editions of catalogue cars that
// rotate every 15 minutes. Same seed = same offers, so the shop is stable
// within a window and changes for everyone at the same time.

import { state } from '../core/store.js';
import { createRng, pick, randRange } from '../core/rng.js';
import { CARS, CAR_CLASSES, PAINT_COLORS } from '../data/cars.js';

export const OFFER_WINDOW_MS = 15 * 60 * 1000;

const EDITIONS = [
    { tag: 'GT', label: 'Power pack', apply: s => { s.hp = Math.round(s.hp * 1.07); } },
    { tag: 'RS', label: 'Lightweight', apply: s => { s.weight -= Math.round(s.weight * 0.05); } },
    { tag: 'EVO', label: 'Track pack', apply: s => { s.grip = +(s.grip + 0.04).toFixed(2); s.brake = +(s.brake + 0.06).toFixed(2); } },
    { tag: 'Rallye', label: 'Gravel pack', apply: s => { s.dirtGrip = +(s.dirtGrip + 0.12).toFixed(2); } },
    { tag: 'Aero', label: 'Aero pack', apply: s => { s.clA = +(s.clA + 0.25).toFixed(2); } },
    { tag: 'X', label: 'Launch pack', apply: s => { s.hp = Math.round(s.hp * 1.04); s.shiftTime = 0.18; } }
];

export function offerWindow(now = Date.now()) {
    return Math.floor(now / OFFER_WINDOW_MS);
}

export function msUntilNextWindow(now = Date.now()) {
    return (offerWindow(now) + 1) * OFFER_WINDOW_MS - now;
}

export function getSpecialOffers(maxTier, now = Date.now()) {
    const windowId = offerWindow(now);
    const rng = createRng(`offers:${windowId}`);
    const classes = CAR_CLASSES.slice(0, Math.min(CAR_CLASSES.length, maxTier + 1));
    const offers = [];
    for (let i = 0; i < 4; i++) {
        const base = pick(rng, CARS.filter(c => classes.includes(c.cls)));
        const edition = pick(rng, EDITIONS);
        const spec = { ...base, baseModelId: base.id };
        edition.apply(spec);
        spec.name = `${base.name} ${edition.tag}`;
        spec.color = pick(rng, PAINT_COLORS);
        spec.price = Math.round((base.price * randRange(rng, 1.12, 1.28)) / 100) * 100;
        spec.blurb = `Limited edition with factory ${edition.label.toLowerCase()}.`;
        spec.edition = edition.label;
        offers.push({ id: `offer-${windowId}-${i}`, spec, price: spec.price });
    }
    return offers.map(o => ({ ...o, sold: state.dealer.boughtOffers.includes(o.id) }));
}
