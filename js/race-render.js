function hashTrackSeed(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createSeededRandom(seed) {
    let value = seed >>> 0;
    return function() {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 4294967296;
    };
}

function getTrackVisualTheme() {
    let name = (currentTrack?.name || '').toLowerCase();
    let dirt = currentTrack?.dirt || 0;
    let tarmac = currentTrack?.tarmac || 0;

    let theme = {
        skyTop: '#2f3f56',
        skyBottom: '#0d131c',
        groundBase: '#23321f',
        groundDark: '#172014',
        groundDetail: '#314a2b',
        accent: '#8BC34A',
        asphalt: '#3b3d42',
        asphaltEdge: '#1f2024',
        shoulder: '#5d5d5d',
        laneMark: '#dfe6d0',
        dirt: '#6b5137',
        mud: '#4e3927',
        dust: '#8b6a47',
        curbA: '#f5f5f5',
        curbB: '#d84343'
    };

    if (name.includes('mud') || name.includes('canyon')) {
        theme.skyTop = '#604538';
        theme.skyBottom = '#1e1714';
        theme.groundBase = '#5a402d';
        theme.groundDark = '#382419';
        theme.groundDetail = '#7a5a40';
        theme.accent = '#c58b58';
        theme.asphalt = '#4a433f';
        theme.shoulder = '#8b6846';
        theme.dirt = '#7b5a3d';
        theme.mud = '#523723';
        theme.dust = '#9b724d';
    } else if (name.includes('dragon') || name.includes('serpent')) {
        theme.skyTop = '#364a5e';
        theme.skyBottom = '#101820';
        theme.groundBase = '#223126';
        theme.groundDark = '#142019';
        theme.groundDetail = '#32513c';
        theme.accent = '#9ccc65';
        theme.asphalt = '#34383d';
        theme.shoulder = '#526254';
        theme.dirt = '#66553f';
        theme.mud = '#473628';
        theme.dust = '#8b7a58';
    } else if (name.includes('hammer')) {
        theme.skyTop = '#44647b';
        theme.skyBottom = '#18242f';
        theme.groundBase = '#314735';
        theme.groundDark = '#1c2a1f';
        theme.groundDetail = '#496650';
        theme.accent = '#7cb342';
    }

    if (dirt > 0.6) {
        theme.asphalt = '#4d463f';
        theme.shoulder = theme.dirt;
        theme.curbA = '#e2d8c7';
        theme.curbB = '#8d6e63';
    } else if (tarmac > 0.85) {
        theme.laneMark = '#f0f3dc';
        theme.shoulder = '#7b7b7b';
    }

    return theme;
}

function traceTrackPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(trackPath[0].x, trackPath[0].y);
    for (let i = 1; i < trackPath.length; i++) ctx.lineTo(trackPath[i].x, trackPath[i].y);
    ctx.closePath();
}

function getTracksidePoint(index, offset) {
    let pathLen = trackPath.length;
    let prev = trackPath[(index - 1 + pathLen) % pathLen];
    let next = trackPath[(index + 1) % pathLen];
    let curr = trackPath[index];
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    let len = Math.max(0.001, Math.hypot(dx, dy));
    let nx = -dy / len;
    let ny = dx / len;
    return {
        x: curr.x + nx * offset,
        y: curr.y + ny * offset,
        nx,
        ny,
        angle: Math.atan2(dy, dx)
    };
}

function drawTree(ctx, x, y, scale, theme) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(-1.5 * scale, 2 * scale, 3 * scale, 10 * scale);
    ctx.beginPath();
    ctx.arc(0, 0, 9 * scale, 0, Math.PI * 2);
    ctx.fillStyle = theme.groundDetail;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-3 * scale, -2 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.arc(4 * scale, -1 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = theme.accent;
    ctx.fill();
    ctx.restore();
}

function drawRock(ctx, x, y, scale, theme) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(-8 * scale, 3 * scale);
    ctx.lineTo(-5 * scale, -4 * scale);
    ctx.lineTo(2 * scale, -6 * scale);
    ctx.lineTo(7 * scale, -2 * scale);
    ctx.lineTo(8 * scale, 4 * scale);
    ctx.closePath();
    ctx.fillStyle = theme.groundDark;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3 * scale, -2 * scale);
    ctx.lineTo(2 * scale, -4 * scale);
    ctx.lineTo(4 * scale, 0);
    ctx.closePath();
    ctx.fillStyle = `${theme.shoulder}aa`;
    ctx.fill();
    ctx.restore();
}

function drawPuddle(ctx, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.ellipse(0, 0, 10 * scale, 6 * scale, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(90, 130, 170, 0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-2 * scale, -1 * scale, 4 * scale, 2 * scale, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220, 240, 255, 0.16)';
    ctx.fill();
    ctx.restore();
}

function drawCone(ctx, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -7 * scale);
    ctx.lineTo(5 * scale, 5 * scale);
    ctx.lineTo(-5 * scale, 5 * scale);
    ctx.closePath();
    ctx.fillStyle = '#ff6f00';
    ctx.fill();
    ctx.fillStyle = '#fff3e0';
    ctx.fillRect(-3.2 * scale, -1 * scale, 6.4 * scale, 1.7 * scale);
    ctx.fillRect(-4.8 * scale, 5 * scale, 9.6 * scale, 2 * scale);
    ctx.restore();
}

function drawBanner(ctx, x, y, angle, scale, theme) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#d7ccc8';
    ctx.fillRect(-14 * scale, 0, 2 * scale, 14 * scale);
    ctx.fillRect(12 * scale, 0, 2 * scale, 14 * scale);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(-12 * scale, -2 * scale, 24 * scale, 8 * scale);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-9 * scale, 0, 18 * scale, 1.5 * scale);
    ctx.restore();
}

function drawSkidMarks(ctx) {
    if ((currentTrack.tarmac || 0) < 0.55) return;
    ctx.save();
    ctx.lineCap = 'round';
    let rng = createSeededRandom(hashTrackSeed(`${currentTrack.name}:skids`));
    for (let i = 0; i < trackPath.length; i += 24) {
        let p0 = trackPath[i];
        let p1 = trackPath[(i + 5) % trackPath.length];
        let c = trackPath[i].curvature || 0;
        if (c < 0.12) continue;
        let jitter = (rng() - 0.5) * 3;
        ctx.beginPath();
        ctx.moveTo(p0.x + jitter, p0.y - 2 + jitter);
        ctx.lineTo(p1.x + jitter, p1.y - 2 + jitter);
        ctx.strokeStyle = 'rgba(10,10,10,0.18)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p0.x - jitter, p0.y + 2 - jitter);
        ctx.lineTo(p1.x - jitter, p1.y + 2 - jitter);
        ctx.strokeStyle = 'rgba(20,20,20,0.12)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
    }
    ctx.restore();
}

function drawTracksideDecor(ctx, theme) {
    let rng = createSeededRandom(hashTrackSeed(`${currentTrack.name}:decor`));
    let dirtHeavy = (currentTrack.dirt || 0) > 0.5;
    let forestHeavy = (currentTrack.tarmac || 0) > 0.4 && (currentTrack.dirt || 0) < 0.7;

    for (let i = 0; i < trackPath.length; i += 18) {
        let side = rng() > 0.5 ? 1 : -1;
        let offset = 22 + rng() * 24;
        let point = getTracksidePoint(i, offset * side);
        let scale = 0.65 + rng() * 0.6;
        let roll = rng();

        if (point.x < -20 || point.x > CANVAS_W + 20 || point.y < -20 || point.y > CANVAS_H + 20) continue;

        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(point.x, point.y + 8 * scale, 10 * scale, 4 * scale, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fill();
        ctx.restore();

        if (roll < (forestHeavy ? 0.45 : 0.20)) {
            drawTree(ctx, point.x, point.y, scale, theme);
        } else if (roll < (dirtHeavy ? 0.68 : 0.42)) {
            drawRock(ctx, point.x, point.y, scale, theme);
        } else if (roll < (dirtHeavy ? 0.86 : 0.58)) {
            drawPuddle(ctx, point.x, point.y, scale);
        } else if (roll < 0.80) {
            drawCone(ctx, point.x, point.y, scale * 0.9);
        } else {
            drawBanner(ctx, point.x, point.y, point.angle + Math.PI / 2, scale * 0.8, theme);
        }
    }
}

function drawTrackBackdrop(ctx, theme) {
    let skyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    skyGradient.addColorStop(0, theme.skyTop);
    skyGradient.addColorStop(0.55, theme.skyBottom);
    skyGradient.addColorStop(1, theme.groundDark);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    let groundGradient = ctx.createLinearGradient(0, CANVAS_H * 0.25, 0, CANVAS_H);
    groundGradient.addColorStop(0, theme.groundBase);
    groundGradient.addColorStop(1, theme.groundDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, CANVAS_H * 0.25, CANVAS_W, CANVAS_H * 0.75);

    let rng = createSeededRandom(hashTrackSeed(`${currentTrack.name}:${currentTrack.tarmac}:${currentTrack.dirt}`));

    for (let i = 0; i < 22; i++) {
        let x = rng() * CANVAS_W;
        let y = CANVAS_H * (0.30 + rng() * 0.68);
        let r = 16 + rng() * 40;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0 ? `${theme.groundDetail}88` : `${theme.groundBase}66`;
        ctx.fill();
    }

    for (let i = 0; i < 14; i++) {
        let x = rng() * CANVAS_W;
        let y = CANVAS_H * (0.34 + rng() * 0.60);
        let w = 18 + rng() * 40;
        let h = 8 + rng() * 22;
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fillStyle = currentTrack.dirt > 0.45 ? `${theme.mud}88` : `${theme.groundDark}77`;
        ctx.fill();
    }
}

function drawTrackSurface(ctx, theme) {
    let mixedSurface = Math.min(1, (currentTrack.dirt || 0) * 1.15);

    traceTrackPath(ctx);
    ctx.lineWidth = 24;
    ctx.strokeStyle = theme.shoulder;
    ctx.stroke();

    traceTrackPath(ctx);
    ctx.lineWidth = 18;
    ctx.strokeStyle = theme.asphaltEdge;
    ctx.stroke();

    traceTrackPath(ctx);
    ctx.lineWidth = 14;
    ctx.strokeStyle = theme.asphalt;
    ctx.stroke();

    if (mixedSurface > 0.08) {
        ctx.save();
        traceTrackPath(ctx);
        ctx.lineWidth = 12;
        ctx.strokeStyle = theme.dirt;
        ctx.stroke();
        ctx.globalAlpha = 0.20 + mixedSurface * 0.28;

        let rng = createSeededRandom(hashTrackSeed(`${currentTrack.name}:surface`));
        for (let i = 0; i < 120; i++) {
            let idx = Math.floor(rng() * trackPath.length);
            let p = trackPath[idx];
            let size = 1 + rng() * 2.6;
            ctx.beginPath();
            ctx.arc(p.x + (rng() - 0.5) * 14, p.y + (rng() - 0.5) * 14, size, 0, Math.PI * 2);
            ctx.fillStyle = i % 2 === 0 ? theme.dust : theme.mud;
            ctx.fill();
        }
        ctx.restore();
    }

    if ((currentTrack.tarmac || 0) > 0.55) {
        traceTrackPath(ctx);
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = `${theme.laneMark}bb`;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if ((currentTrack.tarmac || 0) > 0.75) {
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < trackPath.length; i += 28) {
            let a = trackPath[i];
            let b = trackPath[(i + 3) % trackPath.length];
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineWidth = 4;
            ctx.strokeStyle = (Math.floor(i / 28) % 2 === 0) ? theme.curbA : theme.curbB;
            ctx.stroke();
        }
        ctx.restore();
    }

    drawSkidMarks(ctx);
}

function drawTrackStartLine(ctx) {
    let p0 = trackPath[0];
    let p1 = trackPath[1];
    let angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -12, 4, 24);
    for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(-8 + i * 4, -12, 4, 24);
    }
    ctx.restore();
}

function renderTrack(ctx) {
    if (trackPath.length < 2) return;

    // Minimal classic style: clean background + green racing line only.
    ctx.fillStyle = '#0e1510';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    traceTrackPath(ctx);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#163821';
    ctx.stroke();

    traceTrackPath(ctx);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#41d66b';
    ctx.stroke();

    drawTrackStartLine(ctx);
}

function renderCars(ctx) {
    raceState.forEach(state => {
        if (!state || !state.car || !trackPath.length) return;
        let pathLen = trackPath.length;
        let renderIdx = typeof state.renderProgressIdx === 'number' ? state.renderProgressIdx : state.progressIdx;
        let wrappedIdx = ((renderIdx % pathLen) + pathLen) % pathLen;
        let idx0 = Math.floor(wrappedIdx);
        let idx1 = (idx0 + 1) % pathLen;
        let t = wrappedIdx - idx0;

        let p0 = trackPath[idx0];
        let p1 = trackPath[idx1];
        let pos = {
            x: p0.x + (p1.x - p0.x) * t,
            y: p0.y + (p1.y - p0.y) * t
        };

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = state.car.color || '#ffffff';
        ctx.fill();
        if (state.isPlayer) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'white';
            ctx.stroke();
        }
    });
}

function buildRpmScaleLabelMarkup(labelText, rpmValue, redline, toneClass) {
    let clampedRpmValue = Math.max(0, Math.min(redline, rpmValue));
    let leftPct = redline > 0 ? (clampedRpmValue / redline) * 100 : 0;
    return `<span class="${toneClass}" style="left:${leftPct.toFixed(2)}%">${labelText}</span>`;
}

function buildRpmGuideLinesMarkup(redline) {
    let guides = [];
    let wholeSteps = Math.floor(redline / 1000);

    for (let i = 1; i <= wholeSteps; i++) {
        let rpmValue = i * 1000;
        let leftPct = redline > 0 ? (rpmValue / redline) * 100 : 0;
        guides.push(`<span class="rpm-guide-line" style="left:${leftPct.toFixed(2)}%"></span>`);
    }

    return guides.join('');
}

function buildRpmScaleMarkup(redline) {
    let labels = [];
    let wholeSteps = Math.floor(redline / 1000);

    for (let i = 1; i <= wholeSteps; i++) {
        let rpmValue = i * 1000;
        labels.push(buildRpmScaleLabelMarkup(String(i), rpmValue, redline, i % 2 === 0 ? 'major' : 'minor'));
    }

    return labels.join('');
}

function buildRpmSegmentsMarkup(redline, rpm) {
    let maxStep = Math.max(1, Math.ceil(redline / 1000));
    let segments = [];
    let redlineStartRpm = Math.max(1000, redline - 1000);
    let clampedRpm = Math.max(0, Math.min(redline, rpm));

    for (let i = 0; i < maxStep; i++) {
        let segStart = i * 1000;
        let segEnd = Math.min(redline, (i + 1) * 1000);
        let segRange = Math.max(1, segEnd - segStart);
        let fillRatio = Math.max(0, Math.min(1, (clampedRpm - segStart) / segRange));
        let isRedlineSegment = segEnd > redlineStartRpm;
        let fillClass = isRedlineSegment ? ' redline' : '';

        segments.push(`
            <span class="rpm-segment${isRedlineSegment ? ' is-redline' : ''}" style="flex:${segRange} 0 0;">
                <span class="rpm-segment-fill${fillClass}" style="width:${(fillRatio * 100).toFixed(1)}%"></span>
            </span>
        `);
    }

    return segments.join('');
}

function createLeaderboardRow(state, statusDisplay) {
    let row = document.createElement('div');
    row.className = `leaderboard-row ${state.isPlayer ? 'is-player' : ''}`;
    let uiRpm = typeof state.displayRpm === 'number' ? state.displayRpm : state.rpm;
    let redline = state.car.redline || 8000;
    let rpmPercent = Math.min(100, (uiRpm / redline) * 100);
    let gearDisplay = state.currentGear + 1;
    let speedKmh = Math.round(state.speed * PROGRESS_SCALE * METERS_PER_PROGRESS_STEP * 3.6);
    let gearColor = gearDisplay <= 2 ? '#FF7043' : gearDisplay <= 4 ? '#FFC107' : '#8BC34A';
    let youBadge = state.isPlayer ? '<span class="you-badge">YOU</span>' : '';
    let tunedBadge = (!state.isPlayer && state.isTuned) ? '<span class="tuned-badge">TUNED</span>' : '';
    let redlineIntensity = rpmPercent > 88 ? ((rpmPercent - 88) / 12 * 0.9).toFixed(2) : '0';
    let shiftLightActive = rpmPercent >= 92;
    let redlineGlow = `box-shadow: inset 0 0 10px rgba(244,67,54,${redlineIntensity});`;

    row.innerHTML = `
        <div class="row-color" style="background-color: ${state.car.color}"></div>
        <div class="row-name">${state.car.name}${youBadge}${tunedBadge}</div>
        <div class="row-dashboard">
            <div class="dashboard-gear-panel">
                <span class="gear-label">gear</span>
                <span class="gear-num" style="color:${gearColor}">${gearDisplay}</span>
            </div>
            <div class="dashboard-main-panel">
                <div class="rpm-topline">
                    <div class="shift-light ${shiftLightActive ? 'active' : ''}"></div>
                    <div class="dashboard-speed-badge">${speedKmh}<span>km/h</span></div>
                </div>
                <div class="rpm-bar-bg ${shiftLightActive ? 'is-blinking' : ''}" style="${redlineGlow}">
                    <div class="rpm-segments">${buildRpmSegmentsMarkup(redline, uiRpm)}</div>
                    <div class="rpm-guide-lines">${buildRpmGuideLinesMarkup(redline)}</div>
                </div>
                <div class="rpm-meta-row">
                    <div class="rpm-scale">${buildRpmScaleMarkup(redline)}</div>
                    <div class="rpm-readout">
                        <span class="rpm-text">${Math.round(uiRpm).toLocaleString()} rpm</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="row-timer">${formatLapTime(state.currentLapTime)}</div>
        <div class="row-pct">${statusDisplay}</div>
    `;

    return row;
}

function updateLiveUI(sortedRacers) {
    const list = document.getElementById('live-leaderboard');
    if (!list) return;
    list.innerHTML = '';

    let totalRaceLength = trackPath.length * currentTrack.laps;

    sortedRacers.forEach((state, index) => {
        if (!state || !state.car) return;
        let pct = Math.min(100, (state.totalProgress / totalRaceLength) * 100).toFixed(2);

        if (state.isPlayer) {
            let lastLapDisplay = state.lastLapTime > 0 ? formatLapTime(state.lastLapTime) : '-';
            let completionDisplay = state.finished ? '100%' : `${pct}%`;

            document.getElementById('live-pos').innerText = `${index + 1}/${raceState.length}`;
            document.getElementById('live-lap').innerText = `${state.lap}/${currentTrack.laps}`;
            document.getElementById('live-last-lap').innerText = lastLapDisplay;
            document.getElementById('live-completion').innerText = completionDisplay;
        }

        let statusDisplay = state.finished ? formatLapTime(state.finalTotalTime) : `${pct}%`;
        list.appendChild(createLeaderboardRow(state, statusDisplay));
    });
}
