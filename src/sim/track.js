// Track geometry.
//
// A track definition is just a closed list of control points plus a real lap
// length in metres. buildTrack() turns that into evenly spaced samples (one
// every ~2 m) with a position, heading, real curvature (1/m) and surface mix.
// Everything downstream (physics, AI, rendering) works in metres and seconds.

import { clamp } from '../core/rng.js';

export const SAMPLE_SPACING_M = 2;
const MIN_RADIUS_M = 11;

function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function wrapAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
}

function smoothCircular(values, radius, passes) {
    let current = values;
    const n = values.length;
    for (let p = 0; p < passes; p++) {
        const next = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            let sum = 0;
            for (let k = -radius; k <= radius; k++) sum += current[(i + k + n) % n];
            next[i] = sum / (radius * 2 + 1);
        }
        current = next;
    }
    return current;
}

/**
 * @param {object} def   track definition from src/data/tracks.js
 * @param {object} [opts] { reverse: boolean }
 */
export function buildTrack(def, opts = {}) {
    let pts = def.points.map(([x, y]) => ({ x, y }));
    // `start` picks which control point carries the start/finish line.
    const startAt = def.start || 0;
    if (startAt) pts = [...pts.slice(startAt), ...pts.slice(0, startAt)];
    if (opts.reverse) pts = [pts[0], ...pts.slice(1).reverse()];
    const count = pts.length;

    // 1) Dense spline through the control points.
    const dense = [];
    const perSegment = 32;
    for (let i = 0; i < count; i++) {
        const p0 = pts[(i - 1 + count) % count];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % count];
        const p3 = pts[(i + 2) % count];
        for (let s = 0; s < perSegment; s++) {
            const t = s / perSegment;
            dense.push({ x: catmullRom(p0.x, p1.x, p2.x, p3.x, t), y: catmullRom(p0.y, p1.y, p2.y, p3.y, t) });
        }
    }

    // 2) Measure it, then scale so one lap is exactly def.lengthM metres.
    const cumulative = [0];
    for (let i = 0; i < dense.length; i++) {
        const a = dense[i];
        const b = dense[(i + 1) % dense.length];
        cumulative.push(cumulative[i] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    const rawLength = cumulative[dense.length];
    const scale = def.lengthM / rawLength;

    // 3) Resample at a constant arc-length step.
    const n = Math.max(60, Math.round(def.lengthM / SAMPLE_SPACING_M));
    const ds = def.lengthM / n;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    let seg = 0;
    for (let i = 0; i < n; i++) {
        const target = (i / n) * rawLength;
        while (seg < dense.length - 1 && cumulative[seg + 1] < target) seg++;
        const a = dense[seg];
        const b = dense[(seg + 1) % dense.length];
        const span = Math.max(1e-9, cumulative[seg + 1] - cumulative[seg]);
        const t = clamp((target - cumulative[seg]) / span, 0, 1);
        x[i] = (a.x + (b.x - a.x) * t) * scale;
        y[i] = (a.y + (b.y - a.y) * t) * scale;
    }

    // 4) Heading and signed curvature (1/m), lightly smoothed.
    const heading = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const a = (i - 1 + n) % n;
        const b = (i + 1) % n;
        heading[i] = Math.atan2(y[b] - y[a], x[b] - x[a]);
    }
    let curvature = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const a = (i - 1 + n) % n;
        const b = (i + 1) % n;
        curvature[i] = wrapAngle(heading[b] - heading[a]) / (2 * ds);
    }
    curvature = smoothCircular(curvature, 3, 2);
    const maxK = 1 / MIN_RADIUS_M;
    for (let i = 0; i < n; i++) curvature[i] = clamp(curvature[i], -maxK, maxK);

    // 5) Surface: 0 = tarmac, 1 = dirt. Zones are fractions of the lap.
    let dirt = new Float64Array(n);
    const zones = def.dirtZones || [];
    for (let i = 0; i < n; i++) {
        let f = i / n;
        if (opts.reverse) f = (1 - f) % 1;
        for (const [from, to] of zones) {
            const inside = from <= to ? (f >= from && f < to) : (f >= from || f < to);
            if (inside) dirt[i] = 1;
        }
    }
    if (zones.length) dirt = smoothCircular(dirt, 6, 1);
    let dirtShare = 0;
    for (let i = 0; i < n; i++) dirtShare += dirt[i];
    dirtShare /= n;

    // 6) Bounds + corner list (used by HUD messages and kerb rendering).
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
        minX = Math.min(minX, x[i]); maxX = Math.max(maxX, x[i]);
        minY = Math.min(minY, y[i]); maxY = Math.max(maxY, y[i]);
    }

    const corners = [];
    const cornerThreshold = 1 / 140;
    let start = -1;
    for (let i = 0; i <= n; i++) {
        const k = Math.abs(curvature[i % n]);
        if (k > cornerThreshold && start < 0 && i < n) start = i;
        else if ((k <= cornerThreshold || i === n) && start >= 0) {
            if (i - start >= 5) {
                let apex = start;
                for (let j = start; j < i; j++) if (Math.abs(curvature[j % n]) > Math.abs(curvature[apex % n])) apex = j;
                corners.push({ from: start, to: i - 1, apex: apex % n, dir: Math.sign(curvature[apex % n]) });
            }
            start = -1;
        }
    }
    const cornerIndexAt = new Int16Array(n).fill(-1);
    corners.forEach((c, idx) => {
        c.number = idx + 1;
        for (let j = c.from; j <= c.to; j++) cornerIndexAt[j % n] = idx;
    });

    return {
        def,
        id: def.id,
        name: def.name + (opts.reverse ? ' (Reverse)' : ''),
        reverse: !!opts.reverse,
        length: def.lengthM,
        width: def.width || 12,
        n,
        ds,
        x, y, heading, curvature, dirt,
        dirtShare,
        corners,
        cornerIndexAt,
        scale,
        bounds: { minX, minY, maxX, maxY }
    };
}

/** Index of the sample at lap distance `s` (metres, any sign). */
export function sampleIndex(track, s) {
    const wrapped = ((s % track.length) + track.length) % track.length;
    return Math.min(track.n - 1, Math.floor(wrapped / track.ds));
}

/** Interpolated world position + heading at lap distance `s`, offset sideways by `lateralM`. */
export function trackPose(track, s, lateralM = 0) {
    const wrapped = ((s % track.length) + track.length) % track.length;
    const f = wrapped / track.ds;
    const i0 = Math.floor(f) % track.n;
    const i1 = (i0 + 1) % track.n;
    const t = f - Math.floor(f);
    const px = track.x[i0] + (track.x[i1] - track.x[i0]) * t;
    const py = track.y[i0] + (track.y[i1] - track.y[i0]) * t;
    const h = track.heading[i0] + wrapAngle(track.heading[i1] - track.heading[i0]) * t;
    return {
        x: px - Math.sin(h) * lateralM,
        y: py + Math.cos(h) * lateralM,
        heading: h
    };
}

/** SVG path data for a small track map (used on event cards). */
export function trackSvgPath(track, size = 100, padding = 8) {
    const { minX, minY, maxX, maxY } = track.bounds;
    const w = maxX - minX;
    const h = maxY - minY;
    const k = (size - padding * 2) / Math.max(w, h);
    const ox = padding + ((size - padding * 2) - w * k) / 2;
    const oy = padding + ((size - padding * 2) - h * k) / 2;
    const step = Math.max(1, Math.floor(track.n / 160));
    let d = '';
    for (let i = 0; i < track.n; i += step) {
        d += `${i === 0 ? 'M' : 'L'}${(ox + (track.x[i] - minX) * k).toFixed(1)} ${(oy + (track.y[i] - minY) * k).toFixed(1)}`;
    }
    return {
        d: d + 'Z',
        startX: ox + (track.x[0] - minX) * k,
        startY: oy + (track.y[0] - minY) * k
    };
}
