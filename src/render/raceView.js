// Canvas renderer for a race: scenery, track, cars, effects and the minimap.
//
// Everything is drawn in world metres through a camera transform, so the same
// code serves the zoomed "follow" camera and the full-track overview.

import { createRng, randRange, clamp, lerp } from '../core/rng.js';
import { trackPose } from '../sim/track.js';

const THEMES = {
    industrial: { ground: '#23262b', blot: '#2c3036', road: '#3b3e45', edge: '#d9d9d9', dirt: '#6b5237', decor: ['crate', 'crate', 'lamp'] },
    city: { ground: '#0d1014', blot: '#11151b', road: '#2e3138', edge: '#35f0c0', dirt: '#6b5237', decor: [] },
    night: { ground: '#0a0c18', blot: '#101430', road: '#262a3a', edge: '#ff3bd4', dirt: '#6b5237', decor: ['block', 'block', 'lamp'] },
    forest: { ground: '#1d3120', blot: '#25402a', road: '#3a3d41', edge: '#cfd6c4', dirt: '#74593a', decor: ['tree', 'tree', 'tree', 'rock'] },
    desert: { ground: '#6b5034', blot: '#7a5d3e', road: '#4a4540', edge: '#e2d3b5', dirt: '#8a6a45', decor: ['rock', 'rock', 'cactus'] },
    airfield: { ground: '#2f3d2c', blot: '#384a34', road: '#42454a', edge: '#f1f1f1', dirt: '#6b5237', decor: ['cone', 'crate', 'tree'] },
    alpine: { ground: '#8fa3ad', blot: '#a9bac2', road: '#3a3e44', edge: '#ffffff', dirt: '#6f6a62', decor: ['pine', 'pine', 'rock'] },
    coast: { ground: '#b79a63', blot: '#c6ab75', road: '#3f4247', edge: '#ffffff', dirt: '#8a6a45', decor: ['palm', 'palm', 'rock'] },
    circuit: { ground: '#2a4a2c', blot: '#33582f', road: '#3d4046', edge: '#ffffff', dirt: '#6b5237', decor: ['tree', 'cone', 'stand'] }
};

export function createRaceView(canvas, miniCanvas, race) {
    const ctx = canvas.getContext('2d');
    const mini = miniCanvas.getContext('2d');
    const track = race.track;
    const theme = THEMES[track.def.theme] || THEMES.circuit;
    const halfUsable = race.halfUsable;

    // ── Pre-built geometry ───────────────────────────────────────────────────
    const centre = new Path2D();
    for (let i = 0; i < track.n; i++) {
        if (i === 0) centre.moveTo(track.x[i], track.y[i]);
        else centre.lineTo(track.x[i], track.y[i]);
    }
    centre.closePath();

    const runPath = (predicate) => {
        const path = new Path2D();
        let open = false;
        for (let i = 0; i <= track.n; i++) {
            const j = i % track.n;
            if (predicate(j)) {
                if (!open) { path.moveTo(track.x[j], track.y[j]); open = true; }
                else path.lineTo(track.x[j], track.y[j]);
            } else open = false;
        }
        return path;
    };
    const dirtPath = runPath(i => track.dirt[i] > 0.5);
    const kerbPath = runPath(i => Math.abs(track.curvature[i]) > 1 / 110 && track.dirt[i] < 0.5);

    // Scenery: seeded so a track always looks the same.
    const rng = createRng(`decor:${track.id}`);
    const decor = [];
    if (theme.decor.length) {
        for (let i = 0; i < track.n; i += 7) {
            const side = rng() > 0.5 ? 1 : -1;
            const offset = track.width / 2 + randRange(rng, 11, 40);
            const pose = trackPose(track, i * track.ds, side * offset);
            // Skip anything that would land on another part of the circuit.
            let clear = true;
            for (let j = 0; j < track.n; j += 4) {
                if (Math.hypot(track.x[j] - pose.x, track.y[j] - pose.y) < track.width / 2 + 10) { clear = false; break; }
            }
            if (clear) decor.push({ x: pose.x, y: pose.y, type: theme.decor[Math.floor(rng() * theme.decor.length)], size: randRange(rng, 0.8, 1.5), rot: rng() * Math.PI });
        }
    }
    const blots = [];
    const { minX, minY, maxX, maxY } = track.bounds;
    for (let i = 0; i < 70; i++) {
        blots.push({ x: randRange(rng, minX - 120, maxX + 120), y: randRange(rng, minY - 120, maxY + 120), r: randRange(rng, 14, 60) });
    }

    let backdrop = null;
    if (track.def.image) {
        backdrop = new Image();
        backdrop.src = `${import.meta.env?.BASE_URL || './'}${track.def.image.src}`;
    }

    const skids = [];
    const particles = [];
    const cam = { x: track.x[0], y: track.y[0], zoom: 4, mode: 'follow' };
    let viewW = 0;
    let viewH = 0;

    function resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        viewW = canvas.clientWidth;
        viewH = canvas.clientHeight;
        canvas.width = Math.round(viewW * dpr);
        canvas.height = Math.round(viewH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const mdpr = dpr;
        miniCanvas.width = Math.round(miniCanvas.clientWidth * mdpr);
        miniCanvas.height = Math.round(miniCanvas.clientHeight * mdpr);
    }

    function carPose(car) {
        const pose = trackPose(track, car.s, car.lat * halfUsable);
        // Lean the car into slides for a bit of drama.
        const k = track.curvature[Math.min(track.n - 1, Math.floor((((car.s % track.length) + track.length) % track.length) / track.ds))];
        pose.heading += Math.sign(k) * car.slide * 0.22;
        return pose;
    }

    function drawDecor(d) {
        ctx.save();
        ctx.translate(d.x, d.y);
        const s = d.size;
        switch (d.type) {
            case 'tree':
                ctx.fillStyle = '#16301a'; ctx.beginPath(); ctx.arc(0, 0, 4.2 * s, 0, 7); ctx.fill();
                ctx.fillStyle = '#2f6b35'; ctx.beginPath(); ctx.arc(-1 * s, -1 * s, 3 * s, 0, 7); ctx.fill();
                break;
            case 'pine':
                ctx.fillStyle = '#1c3b2b'; ctx.beginPath(); ctx.arc(0, 0, 3.6 * s, 0, 7); ctx.fill();
                ctx.fillStyle = '#e9f1f4'; ctx.beginPath(); ctx.arc(-0.8 * s, -0.8 * s, 1.6 * s, 0, 7); ctx.fill();
                break;
            case 'palm':
                ctx.strokeStyle = '#2e7d4f'; ctx.lineWidth = 1.1 * s;
                for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a + d.rot) * 4.5 * s, Math.sin(a + d.rot) * 4.5 * s); ctx.stroke(); }
                break;
            case 'cactus':
                ctx.fillStyle = '#3f6b3a'; ctx.beginPath(); ctx.arc(0, 0, 1.6 * s, 0, 7); ctx.fill();
                break;
            case 'rock':
                ctx.rotate(d.rot); ctx.fillStyle = '#00000055'; ctx.fillRect(-3 * s, -2 * s, 6 * s, 4.4 * s);
                ctx.fillStyle = '#7d8087'; ctx.fillRect(-3 * s, -2.4 * s, 5.4 * s, 4 * s);
                break;
            case 'crate':
                ctx.rotate(Math.round(d.rot / (Math.PI / 2)) * (Math.PI / 2));
                ctx.fillStyle = ['#b5452f', '#2f6fb5', '#c9962c', '#3d8f5a'][Math.floor(d.size * 10) % 4];
                ctx.fillRect(-6 * s, -2.6, 12 * s, 5.2);
                ctx.strokeStyle = '#0005'; ctx.lineWidth = 0.4; ctx.strokeRect(-6 * s, -2.6, 12 * s, 5.2);
                break;
            case 'block':
                ctx.rotate(Math.round(d.rot / (Math.PI / 2)) * (Math.PI / 2));
                ctx.fillStyle = '#141833'; ctx.fillRect(-8 * s, -6 * s, 16 * s, 12 * s);
                ctx.strokeStyle = ['#ff3bd4', '#35f0c0', '#58b4ff'][Math.floor(d.size * 10) % 3]; ctx.lineWidth = 0.7;
                ctx.strokeRect(-8 * s, -6 * s, 16 * s, 12 * s);
                break;
            case 'stand':
                ctx.rotate(Math.round(d.rot / (Math.PI / 2)) * (Math.PI / 2));
                ctx.fillStyle = '#56606c'; ctx.fillRect(-10, -3.5, 20, 7);
                ctx.fillStyle = '#c0392b'; ctx.fillRect(-10, -3.5, 20, 2);
                break;
            case 'lamp':
                ctx.fillStyle = '#ffe9a81f'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
                ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(0, 0, 0.9, 0, 7); ctx.fill();
                break;
            default: // cone
                ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.arc(0, 0, 0.9, 0, 7); ctx.fill();
        }
        ctx.restore();
    }

    function drawCar(car, pose, scale) {
        const L = 4.6 * scale;
        const W = 2.0 * scale;
        ctx.save();
        ctx.translate(pose.x, pose.y);
        ctx.rotate(pose.heading);
        ctx.fillStyle = '#00000066';
        ctx.fillRect(-L / 2 + 0.35 * scale, -W / 2 + 0.35 * scale, L, W);
        if (car.nitroActive) {
            ctx.fillStyle = '#6fb3ff';
            ctx.beginPath(); ctx.moveTo(-L / 2, -W * 0.3); ctx.lineTo(-L / 2 - (2.2 + Math.random() * 1.6) * scale, 0); ctx.lineTo(-L / 2, W * 0.3); ctx.fill();
        }
        ctx.fillStyle = '#111';
        const wx = L * 0.3, wy = W / 2;
        [[-wx, -wy], [wx, -wy], [-wx, wy], [wx, wy]].forEach(([x, y]) => ctx.fillRect(x - 0.5 * scale, y - 0.22 * scale, scale, 0.44 * scale));
        ctx.fillStyle = car.entry.color;
        ctx.beginPath();
        ctx.roundRect(-L / 2, -W / 2, L, W, 0.6 * scale);
        ctx.fill();
        ctx.fillStyle = '#0d1117cc';
        ctx.beginPath(); ctx.roundRect(-L * 0.18, -W * 0.38, L * 0.42, W * 0.76, 0.3 * scale); ctx.fill();
        ctx.fillStyle = car.entry.color;
        ctx.fillRect(-L * 0.05, -W * 0.38, L * 0.14, W * 0.76);
        if (car.brake > 0.3) { ctx.fillStyle = '#ff2a1f'; ctx.fillRect(-L / 2, -W / 2, 0.35 * scale, W); }
        ctx.fillStyle = '#ffe9a8'; ctx.fillRect(L / 2 - 0.3 * scale, -W / 2 + 0.1 * scale, 0.3 * scale, 0.45 * scale); ctx.fillRect(L / 2 - 0.3 * scale, W / 2 - 0.55 * scale, 0.3 * scale, 0.45 * scale);
        if (car.isPlayer) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.22 * scale; ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, 0.6 * scale); ctx.stroke(); }
        ctx.restore();
    }

    function updateEffects(dt) {
        for (const car of race.cars) {
            if (car.finished && car.v < 1) continue;
            const pose = carPose(car);
            const idx = Math.min(track.n - 1, Math.floor((((car.s % track.length) + track.length) % track.length) / track.ds));
            const onDirt = track.dirt[idx] > 0.5;
            if (car.slide > 0.25 || car.mistakeTimer > 0) {
                skids.push({ x: pose.x, y: pose.y, a: 0.5 });
                if (skids.length > 900) skids.shift();
            }
            const smoke = car.mistakeTimer > 0 || car.slide > 0.5 || (onDirt && car.v > 12) || (car.v < 14 && car.throttle > 0.9 && race.time < 3 && race.time > 0);
            if (smoke && particles.length < 260 && Math.random() < 0.5) {
                particles.push({
                    x: pose.x - Math.cos(pose.heading) * 2, y: pose.y - Math.sin(pose.heading) * 2,
                    vx: randRange(Math.random, -1.5, 1.5), vy: randRange(Math.random, -1.5, 1.5),
                    life: 1, r: onDirt ? 1.6 : 1.1, dust: onDirt
                });
            }
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt * 1.3;
            p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 3;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function draw(dt) {
        updateEffects(dt);
        const focus = race.player || race.order[0];
        const focusPose = carPose(focus);
        const spanX = maxX - minX + 80;
        const spanY = maxY - minY + 80;
        const fitZoom = Math.min(viewW / spanX, viewH / spanY);
        let targetZoom;
        let tx;
        let ty;
        if (cam.mode === 'overview') {
            targetZoom = fitZoom;
            tx = (minX + maxX) / 2;
            ty = (minY + maxY) / 2;
        } else {
            const base = clamp(Math.min(viewW, viewH) / 150, 4.6, 7.5);
            targetZoom = Math.max(fitZoom, base * lerp(1, 0.62, clamp(focus.v / 75, 0, 1)));
            const lead = clamp(focus.v * 0.55, 0, 34);
            tx = focusPose.x + Math.cos(focusPose.heading) * lead;
            ty = focusPose.y + Math.sin(focusPose.heading) * lead;
        }
        const ease = Math.min(1, dt * 3.2);
        cam.zoom += (targetZoom - cam.zoom) * ease;
        cam.x += (tx - cam.x) * Math.min(1, dt * 4.5);
        cam.y += (ty - cam.y) * Math.min(1, dt * 4.5);

        ctx.fillStyle = theme.ground;
        ctx.fillRect(0, 0, viewW, viewH);
        ctx.save();
        ctx.translate(viewW / 2, viewH / 2);
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-cam.x, -cam.y);

        const halfW = viewW / 2 / cam.zoom + 30;
        const halfH = viewH / 2 / cam.zoom + 30;
        const visible = (x, y) => Math.abs(x - cam.x) < halfW && Math.abs(y - cam.y) < halfH;

        if (backdrop && backdrop.complete && backdrop.naturalWidth) {
            ctx.globalAlpha = 0.8;
            ctx.drawImage(backdrop, 0, 0, track.def.image.w * track.scale, track.def.image.h * track.scale);
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = theme.blot;
            for (const b of blots) if (visible(b.x, b.y)) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
        }

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        // Kerbs peek out from under the tarmac on corners.
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#d63a2f'; ctx.lineWidth = track.width + 3.2; ctx.stroke(kerbPath);
        ctx.lineDashOffset = 3;
        ctx.strokeStyle = '#f2f2f2'; ctx.stroke(kerbPath);
        ctx.lineDashOffset = 0;
        ctx.setLineDash([]);
        ctx.strokeStyle = theme.edge; ctx.lineWidth = track.width + 1; ctx.globalAlpha = backdrop ? 0.9 : 0.75; ctx.stroke(centre);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = theme.road; ctx.lineWidth = track.width; ctx.stroke(centre);
        ctx.lineCap = 'butt';
        ctx.strokeStyle = theme.dirt; ctx.lineWidth = track.width; ctx.stroke(dirtPath);
        ctx.setLineDash([4, 8]);
        ctx.strokeStyle = '#ffffff2e'; ctx.lineWidth = 0.35; ctx.stroke(centre);
        ctx.setLineDash([]);

        // Start/finish line (chequered) and grid boxes.
        const start = trackPose(track, 0, 0);
        ctx.save();
        ctx.translate(start.x, start.y);
        ctx.rotate(start.heading);
        const cell = track.width / 8;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 2; c++) {
            ctx.fillStyle = (r + c) % 2 ? '#111' : '#f5f5f5';
            ctx.fillRect(c * cell - cell, -track.width / 2 + r * cell, cell, cell);
        }
        ctx.restore();

        ctx.fillStyle = '#0a0a0a';
        for (const m of skids) if (visible(m.x, m.y)) { ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.arc(m.x, m.y, 0.55, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;

        for (const d of decor) if (visible(d.x, d.y)) drawDecor(d);

        const scale = clamp(6.5 / cam.zoom, 1, 6); // keep cars readable when zoomed out
        const poses = race.cars.map(car => ({ car, pose: carPose(car) }));
        poses.sort((a, b) => (a.car.isPlayer ? 1 : 0) - (b.car.isPlayer ? 1 : 0));
        for (const { car, pose } of poses) drawCar(car, pose, scale);

        for (const p of particles) {
            ctx.globalAlpha = Math.max(0, p.life) * 0.45;
            ctx.fillStyle = p.dust ? '#b89468' : '#d8d8d8';
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // Name tags in screen space so they stay crisp.
        ctx.font = '700 11px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        for (const { car, pose } of poses) {
            const sx = (pose.x - cam.x) * cam.zoom + viewW / 2;
            const sy = (pose.y - cam.y) * cam.zoom + viewH / 2 - (2.4 * scale * cam.zoom + 8);
            if (sx < -40 || sx > viewW + 40 || sy < -20 || sy > viewH + 20) continue;
            const label = `P${car.position} ${car.isPlayer ? 'YOU' : car.entry.name.split(' ')[0]}`;
            const w = ctx.measureText(label).width + 10;
            ctx.fillStyle = car.isPlayer ? '#ff3b2fdd' : '#0b0c0fcc';
            ctx.fillRect(sx - w / 2, sy - 11, w, 15);
            ctx.fillStyle = '#fff';
            ctx.fillText(label, sx, sy);
        }

        drawMini(poses);
    }

    function drawMini(poses) {
        const w = miniCanvas.width;
        const h = miniCanvas.height;
        const pad = w * 0.1;
        const k = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
        const ox = (w - (maxX - minX) * k) / 2 - minX * k;
        const oy = (h - (maxY - minY) * k) / 2 - minY * k;
        mini.setTransform(1, 0, 0, 1, 0, 0);
        mini.clearRect(0, 0, w, h);
        mini.setTransform(k, 0, 0, k, ox, oy);
        mini.lineJoin = 'round';
        mini.strokeStyle = '#ffffffcc';
        mini.lineWidth = 3 / k * (w / 180);
        mini.stroke(centre);
        mini.strokeStyle = '#c08a4a';
        mini.stroke(dirtPath);
        for (const { car, pose } of poses) {
            mini.fillStyle = car.entry.color;
            mini.beginPath();
            mini.arc(pose.x, pose.y, (car.isPlayer ? 6 : 4.2) / k * (w / 180), 0, 7);
            mini.fill();
            if (car.isPlayer) { mini.strokeStyle = '#fff'; mini.lineWidth = 1.6 / k * (w / 180); mini.stroke(); }
        }
    }

    resize();
    return {
        draw,
        resize,
        setCameraMode(mode) { cam.mode = mode; },
        getCameraMode() { return cam.mode; }
    };
}
