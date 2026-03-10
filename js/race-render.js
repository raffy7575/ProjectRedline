function renderTrack(ctx) {
    if (trackPath.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(trackPath[0].x, trackPath[0].y);
    for (let i = 1; i < trackPath.length; i++) ctx.lineTo(trackPath[i].x, trackPath[i].y);
    ctx.closePath();
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#333';
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8BC34A';
    ctx.stroke();

    let p0 = trackPath[0];
    let p1 = trackPath[1];
    let angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 10);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
}

function renderCars(ctx) {
    raceState.forEach(state => {
        let pathLen = trackPath.length;
        let wrappedIdx = ((state.progressIdx % pathLen) + pathLen) % pathLen;
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
        ctx.fillStyle = state.car.color;
        ctx.fill();
        if (state.isPlayer) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'white';
            ctx.stroke();
        }
    });
}

function createLeaderboardRow(state, statusDisplay) {
    let row = document.createElement('div');
    row.className = `leaderboard-row ${state.isPlayer ? 'is-player' : ''}`;
    let rpmPercent = Math.min(100, (state.rpm / (state.car.redline || 8000)) * 100);
    let gearDisplay = state.currentGear + 1;
    let speedKmh = Math.round(state.speed * PROGRESS_SCALE * METERS_PER_PROGRESS_STEP * 3.6);
    let gearColor = gearDisplay <= 2 ? '#FF7043' : gearDisplay <= 4 ? '#FFC107' : '#8BC34A';
    let youBadge = state.isPlayer ? '<span class="you-badge">YOU</span>' : '';
    let redlineGlow = rpmPercent > 88 ? `box-shadow: inset 0 0 8px rgba(244,67,54,${((rpmPercent - 88) / 12 * 0.9).toFixed(2)});` : '';

    row.innerHTML = `
        <div class="row-color" style="background-color: ${state.car.color}"></div>
        <div class="row-name">${state.car.name}${youBadge}</div>
        <div class="gear-badge">
            <span class="gear-label">gear</span>
            <span class="gear-num" style="color:${gearColor}">${gearDisplay}</span>
        </div>
        <div class="row-rpm">
            <div class="rpm-bar-bg" style="${redlineGlow}">
                <div class="rpm-bar-fill" style="width:${rpmPercent.toFixed(1)}%"></div>
            </div>
            <div class="rpm-readout">
                <span class="rpm-text">${Math.round(state.rpm).toLocaleString()} rpm</span>
                <span class="speed-text">${speedKmh} km/h</span>
            </div>
        </div>
        <div class="row-timer">${formatLapTime(state.currentLapTime)}</div>
        <div class="row-pct">${statusDisplay}</div>
    `;

    return row;
}

function updateLiveUI(sortedRacers) {
    const list = document.getElementById('live-leaderboard');
    list.innerHTML = '';

    let totalRaceLength = trackPath.length * currentTrack.laps;

    sortedRacers.forEach((state, index) => {
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
