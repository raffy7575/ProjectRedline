function completeInitialization() {
    updateHUD();
    buildGarage();
    renderCareerMode();
    buildSkillTree();
    buildMaintenancePanel();
    updateTabGates();
    if (selectedPlayerCar) {
        selectCar(selectedPlayerCar);
    }
}

function openTab(tabId, btn) {
    // Gate: block locked tabs and show a tooltip instead
    if (btn && btn.classList.contains('tab-locked')) return;

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
    if (tabId === 'tab-tuning') buildTuningShop();
    if (tabId === 'tab-dealership') { buildDealership(); startDealerCountdownTimer(); }
}

function updateTabGates() {
    let tuningBtn = document.getElementById('tab-btn-tuning');
    let tuningUnlocked = isFeatureUnlocked('tuningShop');
    if (tuningBtn) {
        if (tuningUnlocked) {
            tuningBtn.classList.remove('tab-locked');
            tuningBtn.title = '';
            tuningBtn.textContent = 'Tuning Shop';
        } else {
            tuningBtn.classList.add('tab-locked');
            tuningBtn.title = getFeatureUnlockLabel('tuningShop');
            tuningBtn.textContent = '🔒 Tuning Shop';
            // If currently on tuning tab, bounce back to garage
            if (document.getElementById('tab-tuning').classList.contains('active')) {
                let garageBtn = document.querySelector('.tab-btn[data-tab="tab-garage"]');
                if (garageBtn) openTab('tab-garage', garageBtn);
            }
        }
    }
}

function updateHUD() {
    document.getElementById('player-name').innerText = playerData.name || 'Driver';
    document.getElementById('overlay-player-name').innerText = playerData.name || 'Driver';
    document.getElementById('player-money').innerText = playerData.money.toLocaleString();
}

function clampCondition(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
}

function getCarCondition(carId) {
    if (!playerData.carCondition || typeof playerData.carCondition !== 'object') {
        playerData.carCondition = {};
    }

    if (!playerData.carCondition[carId]) {
        playerData.carCondition[carId] = { engine: 100, tires: 100, suspension: 100 };
    }

    let c = playerData.carCondition[carId];
    c.engine = clampCondition(c.engine);
    c.tires = clampCondition(c.tires);
    c.suspension = clampCondition(c.suspension);
    return c;
}

function getConditionWearFactors(condition) {
    let engine = condition.engine / 100;
    let tires = condition.tires / 100;
    let suspension = condition.suspension / 100;

    return {
        topSpeed: 0.55 + engine * 0.45,
        acceleration: 0.60 + engine * 0.40,
        handling: (0.55 + tires * 0.45) * (0.65 + suspension * 0.35),
        braking: (0.62 + tires * 0.38) * (0.70 + suspension * 0.30),
        tarmac: 0.65 + tires * 0.35,
        dirt: 0.65 + tires * 0.35
    };
}

function getConditionColor(conditionPct) {
    if (conditionPct >= 75) return '#4CAF50';
    if (conditionPct >= 45) return '#FFC107';
    return '#F44336';
}

function getRepairCost(carId, component) {
    let rates = { engine: 45, tires: 30, suspension: 35 };
    let condition = getCarCondition(carId);
    let missing = Math.max(0, 100 - condition[component]);
    return Math.ceil(missing * (rates[component] || 30));
}

function getTotalServiceCost(carId) {
    return getRepairCost(carId, 'engine') + getRepairCost(carId, 'tires') + getRepairCost(carId, 'suspension');
}

function repairComponent(component) {
    if (!selectedPlayerCar) return;
    let carId = selectedPlayerCar.id;
    let cost = getRepairCost(carId, component);
    if (cost <= 0 || playerData.money < cost) return;

    playerData.money -= cost;
    getCarCondition(carId)[component] = 100;
    updateHUD();
    buildGarage();
    selectCar(selectedPlayerCar);
    buildMaintenancePanel();
    saveGameState();
}

function repairAllComponents() {
    if (!selectedPlayerCar) return;
    let carId = selectedPlayerCar.id;
    let cost = getTotalServiceCost(carId);
    if (cost <= 0 || playerData.money < cost) return;

    playerData.money -= cost;
    let c = getCarCondition(carId);
    c.engine = 100;
    c.tires = 100;
    c.suspension = 100;

    updateHUD();
    buildGarage();
    selectCar(selectedPlayerCar);
    buildMaintenancePanel();
    saveGameState();
}

function buildMaintenancePanel() {
    let panel = document.getElementById('maintenance-panel');
    if (!panel) return;

    // Feature gate: hide entirely if Wear & Tear is not yet unlocked
    if (!isFeatureUnlocked('wearAndTear')) {
        panel.style.display = 'none';
        panel.innerHTML = '';
        return;
    }

    if (!selectedPlayerCar) {
        panel.style.display = 'none';
        panel.innerHTML = '';
        return;
    }

    let condition = getCarCondition(selectedPlayerCar.id);
    let components = [
        { key: 'engine', label: 'Engine' },
        { key: 'tires', label: 'Tires' },
        { key: 'suspension', label: 'Suspension' }
    ];

    let rows = components.map(c => {
        let pct = Math.round(condition[c.key]);
        let cost = getRepairCost(selectedPlayerCar.id, c.key);
        let canAfford = playerData.money >= cost;
        return `
            <div class="maintenance-row">
                <div class="maintenance-label">${c.label}</div>
                <div class="condition-wrap">
                    <div class="condition-bar"><div class="condition-fill" style="width:${pct}%; background:${getConditionColor(pct)}"></div></div>
                    <div class="condition-text">${pct}% health</div>
                </div>
                <button class="maintenance-btn ${cost > 0 && canAfford ? 'action-btn' : ''}" ${cost <= 0 || !canAfford ? 'disabled' : ''} onclick="repairComponent('${c.key}')">${cost <= 0 ? 'OK' : '$' + cost.toLocaleString()}</button>
            </div>
        `;
    }).join('');

    let fullCost = getTotalServiceCost(selectedPlayerCar.id);
    let canRepairAll = fullCost > 0 && playerData.money >= fullCost;

    panel.innerHTML = `
        <div class="maintenance-title">Wear & Maintenance · ${selectedPlayerCar.name}</div>
        <div class="maintenance-sub">Race usage degrades performance. Repair to keep stats at 100%.</div>
        <div class="maintenance-grid">${rows}</div>
        <div class="maintenance-summary">
            <span>Full Service: <strong>$${fullCost.toLocaleString()}</strong></span>
            <button class="maintenance-btn ${canRepairAll ? 'action-btn' : ''}" ${!canRepairAll ? 'disabled' : ''} onclick="repairAllComponents()">Repair All</button>
        </div>
    `;
    panel.style.display = 'block';
}

function getCarStats(car, options = {}) {
    let applyWear = options.applyWear !== false;
    let stats = { ...car.baseStats };
    car.upgrades.forEach(upgradeId => {
        Object.values(shopItems).flat().forEach(item => {
            if (item.id === upgradeId) {
                for (const [stat, boost] of Object.entries(item.boosts)) {
                    stats[stat] = Math.min(100, Math.max(0, stats[stat] + boost));
                }
            }
        });
    });

    if (applyWear) {
        let c = getCarCondition(car.id);
        let wear = getConditionWearFactors(c);
        stats.topSpeed = Math.max(0, Math.round(stats.topSpeed * wear.topSpeed));
        stats.acceleration = Math.max(0, Math.round(stats.acceleration * wear.acceleration));
        stats.handling = Math.max(0, Math.round(stats.handling * wear.handling));
        stats.braking = Math.max(0, Math.round(stats.braking * wear.braking));
        stats.tarmac = Math.max(0, Math.round(stats.tarmac * wear.tarmac));
        stats.dirt = Math.max(0, Math.round(stats.dirt * wear.dirt));
    }

    return stats;
}

function buildInspectionBadges(validation) {
    if (!validation || !Array.isArray(validation.checks) || !validation.checks.length) {
        return '<span class="inspection-badge inspection-pass">Open Regulations</span>';
    }

    return validation.checks.map(check => {
        let stateClass = check.passed ? 'inspection-pass' : 'inspection-fail';
        let valueHint = typeof check.actual === 'number' ? ` (${Math.round(check.actual)})` : '';
        return `<span class="inspection-badge ${stateClass}" title="Car value${valueHint}">${check.label}</span>`;
    }).join('');
}

function buildStandingsTableHTML(activeLeague) {
    if (!activeLeague) return '';

    let standings = getLeagueStandings(activeLeague.id);
    if (!standings.length) return '';

    let rows = standings.map((entry, index) => {
        let highlightClass = entry.driverId === 'player' ? 'is-player' : '';
        let bestFinish = Number.isFinite(entry.bestFinish) ? formatPositionLabel(entry.bestFinish) : '-';

        let tunedBadge = '';
        if (entry.driverId && entry.driverId.startsWith('ai:')) {
            let carId = entry.driverId.slice(3);
            let rival = Array.isArray(aiRivals) ? aiRivals.find(r => r.carId === carId) : null;
            if (rival && typeof ensureAiCareerState === 'function') {
                let aiSt = ensureAiCareerState();
                let rs = aiSt.rivals[rival.id];
                if (rs && Array.isArray(rs.ownedUpgradeIds) && rs.ownedUpgradeIds.length > 0) {
                    tunedBadge = '<span class="tuned-badge">TUNED</span>';
                }
            }
        }

        return `
            <div class="standings-row ${highlightClass}">
                <div>${index + 1}</div>
                <div>${entry.driverName}${tunedBadge}</div>
                <div>${entry.points || 0}</div>
                <div>${entry.wins || 0}</div>
                <div>${entry.podiums || 0}</div>
                <div>${bestFinish}</div>
            </div>
        `;
    }).join('');

    return `
        <div class="standings-panel">
            <div class="standings-title">Championship Standings · ${activeLeague.name}</div>
            <div class="standings-head">
                <div>#</div>
                <div>Driver</div>
                <div>Pts</div>
                <div>Wins</div>
                <div>Podiums</div>
                <div>Best</div>
            </div>
            ${rows}
        </div>
    `;
}

function buildRivalIntelHTML(activeLeague) {
    if (!activeLeague || typeof getAiUpgradeFeedForLeague !== 'function') return '';

    // Feature gate: hide Rival Intel until Class B
    if (!isFeatureUnlocked('rivalIntel')) return '';

    let feed = getAiUpgradeFeedForLeague(activeLeague.id);

    if (!feed.length) {
        return `
            <div class="rival-intel-panel">
                <div class="rival-intel-title">Rival Intel</div>
                <div class="rival-intel-empty">No rival activity yet &mdash; race to see their upgrades.</div>
            </div>
        `;
    }

    let recent = [...feed].reverse().slice(0, 5);
    let entriesHTML = recent.map(entry => {
        let rival = Array.isArray(aiRivals) ? aiRivals.find(r => r.id === entry.rivalId) : null;
        let bias = rival ? rival.buildBias : 'balanced';
        let firstName = (entry.rivalName || entry.rivalId || 'Rival').split(' ')[0];
        let itemName = entry.itemName || 'an upgrade';

        let text;
        if (bias === 'power')   text = `${firstName} just installed a ${itemName}.`;
        else if (bias === 'grip')    text = `${firstName} optimized grip with a ${itemName}.`;
        else if (bias === 'offroad') text = `${firstName} fitted a ${itemName} for rough terrain.`;
        else                         text = `${firstName} upgraded their build with a ${itemName}.`;

        return `
            <div class="rival-intel-entry">
                <div class="rival-intel-dot"></div>
                <span>${text}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="rival-intel-panel">
            <div class="rival-intel-title">Rival Intel</div>
            ${entriesHTML}
        </div>
    `;
}

function renderCareerMode() {
    ensureCareerProgress();

    let container = document.getElementById('career-mode');
    if (!container) return;

    if (!Array.isArray(leagues) || !leagues.length) {
        container.innerHTML = '<div class="career-empty">No leagues available.</div>';
        return;
    }


    let leaguesHTML = leagues
        .filter(league => isLeagueUnlocked(league.id))
        .map((league, leagueIndex) => {
        let leagueUnlocked = isLeagueUnlocked(league.id);
        let leagueCompleted = isLeagueCompleted(league.id);
        let headerState = 'LOCKED';
        if (leagueCompleted) headerState = 'COMPLETED';
        else if (leagueUnlocked) headerState = 'ACTIVE';

        let cardsHTML = league.events.map((event, eventIndex) => {
            let track = getEventTrack(event);
            let validation = validateCarForEvent(selectedPlayerCar, event);
            let eventUnlocked = isEventUnlocked(league, eventIndex);
            let eventCompleted = isEventCompleted(event.id);
            let bestPos = getEventBestPosition(event.id);
            let requiredPosition = getEventRequiredPosition(event);
            let targetLabel = formatPositionLabel(requiredPosition);
            let targetMet = didMeetEventPolicy(event, bestPos || 999);

            let hasTrack = !!track;
            let passInspection = validation.isEligible;
            let canEnter = leagueUnlocked && eventUnlocked && hasTrack && !!selectedPlayerCar && passInspection;

            let surfaceText = track
                ? `${Math.round((track.tarmac || 0) * 100)}% Tarmac | ${Math.round((track.dirt || 0) * 100)}% Dirt`
                : 'Track unavailable';

            let inspectionState = validation.isEligible
                ? '<span class="inspection-status pass">Passed</span>'
                : '<span class="inspection-status fail">Failed</span>';

            let eventStateBadge = '';
            if (eventCompleted) {
                eventStateBadge = `<span class="event-state-badge completed">Completed${bestPos ? ` · P${bestPos}` : ''}</span>`;
            } else if (!eventUnlocked || !leagueUnlocked) {
                eventStateBadge = '<span class="event-state-badge locked">Locked</span>';
            } else {
                eventStateBadge = '<span class="event-state-badge open">Open</span>';
            }

            let lockReason = '';
            if (!leagueUnlocked) lockReason = 'Complete previous league to unlock.';
            else if (!eventUnlocked) lockReason = 'Complete previous event in this league first.';
            else if (!selectedPlayerCar) lockReason = 'Select a car in My Cars to enter.';
            else if (!passInspection) lockReason = 'Car failed Tech Inspection restrictions.';
            else if (!hasTrack) lockReason = 'Event track is unavailable.';

            return `
                <div class="event-card ${!canEnter ? 'locked' : ''}">
                    <div class="event-top-row">
                        <div>
                            <div class="event-name">${event.name}</div>
                            <div class="event-track">${track ? track.name : 'Unknown Track'} · ${track ? track.laps : '-'} laps</div>
                        </div>
                        <div class="event-right-meta">
                            ${eventStateBadge}
                            <div class="event-prize">$${event.prize.toLocaleString()}</div>
                        </div>
                    </div>
                    <div class="event-surface">${surfaceText}</div>
                    <div class="event-target ${targetMet ? 'met' : 'pending'}">Target: ${targetLabel} or better</div>
                    <div class="inspection-box">
                        <div class="inspection-title">Tech Inspection ${inspectionState}</div>
                        <div class="inspection-badges">${buildInspectionBadges(validation)}</div>
                    </div>
                    ${lockReason ? `<div class="event-lock-reason">${lockReason}</div>` : ''}
                    <button class="action-btn" ${canEnter ? '' : 'disabled'} onclick="startSimulation('${event.id}')">
                        ${canEnter ? (eventCompleted ? 'Race Again' : 'Enter Race') : 'Locked'}
                    </button>
                </div>
            `;
        }).join('');

        return `
            <div class="league-block ${leagueUnlocked ? '' : 'league-locked'}" data-league-index="${leagueIndex}">
                <div class="league-header">
                    <div class="league-class">${league.class}</div>
                    <h2>${league.name}</h2>
                    <p>${league.description}</p>
                    <div class="league-state-badge ${headerState.toLowerCase()}">${headerState}</div>
                </div>
                <div class="event-card-list">${cardsHTML}</div>
            </div>
        `;
    }).join('');

    let activeLeague = getActiveLeague();
    let standingsHTML = buildStandingsTableHTML(activeLeague);
    let rivalIntelHTML = buildRivalIntelHTML(activeLeague);
    container.innerHTML = `${standingsHTML}${rivalIntelHTML}${leaguesHTML}`;
}

function buildGarage() {
    const ownedGrid = document.getElementById('owned-car-grid');
    if (!ownedGrid) return;

    ownedGrid.innerHTML = '';
    let ownedCount = 0;
    let firstOwnedCar = null;

    cars.forEach(car => {
        if (!playerData.ownedCars.includes(car.id)) return;
        
        if (!firstOwnedCar) firstOwnedCar = car;
        ownedCount++;

        let stats = getCarStats(car);
        let card = document.createElement('div');
        card.className = 'car-card owned';
        card.id = `card-${car.id}`;

        if (selectedPlayerCar && selectedPlayerCar.id === car.id) card.classList.add('selected');
        card.onclick = () => selectCar(car);

        let c = getCarCondition(car.id);
        let conditionHTML = `<div class="condition-quick">ENG ${Math.round(c.engine)}% · TIR ${Math.round(c.tires)}% · SUS ${Math.round(c.suspension)}%</div>`;

        card.innerHTML = `
            <div class="car-name"><span style="color:${car.color}">■</span> ${car.name}</div>
            ${conditionHTML}
            ${generateStatHTML('Top Speed', stats.topSpeed, car.baseStats.topSpeed)}
            ${generateStatHTML('Acceleration', stats.acceleration, car.baseStats.acceleration)}
            ${generateStatHTML('Braking', stats.braking, car.baseStats.braking)}
            ${generateStatHTML('Handling', stats.handling, car.baseStats.handling)}
            ${generateStatHTML('Tarmac', stats.tarmac, car.baseStats.tarmac)}
            ${generateStatHTML('Dirt', stats.dirt, car.baseStats.dirt)}
        `;

        ownedGrid.appendChild(card);
        ownedCount++;
    });

    // Auto-select first car if none is selected
    if (!selectedPlayerCar && firstOwnedCar) {
        selectCar(firstOwnedCar);
    }

    if (!ownedCount) {
        ownedGrid.innerHTML = '<div style=\"flex:1 0 100%; color:#9e9e9e; font-size:0.9em; padding:8px 2px;\">No cars yet. Visit the <strong>Dealership</strong> tab to buy your first car.</div>';
    }

    renderCareerMode();
}

function buyCar(carId, price) {
    if (playerData.money >= price) {
        playerData.money -= price;
        playerData.ownedCars.push(carId);
        updateHUD();
        let boughtCar = cars.find(c => c.id === carId);
        selectCar(boughtCar);
        buildDealership();
        switchToTab('tab-garage');
        saveGameState();
    }
}

function generateStatHTML(label, totalVal, baseVal) {
    let upgradeVal = totalVal - baseVal;
    let basePct = Math.min(100, baseVal);
    let upgPct = Math.min(100 - basePct, upgradeVal);

    return `
        <div class="stat-label"><span>${label}</span><span>${totalVal}</span></div>
        <div class="stat-bar-bg" style="display:flex;">
            <div class="stat-bar-fill" style="width:${basePct}%;"></div>
            ${upgPct > 0 ? `<div class="stat-bar-fill upgrade" style="width:${upgPct}%;"></div>` : ''}
        </div>
    `;
}

function selectCar(car) {
    selectedPlayerCar = car;
    saveGameState();
    buildGarage();

    let stats = getCarStats(car);
    document.getElementById('sidebar-car-name').innerText = car.name;
    document.getElementById('sidebar-car-name').style.color = car.color;
    let c = getCarCondition(car.id);
    document.getElementById('sidebar-stats').innerHTML = `
        ${generateStatHTML('Top Speed', stats.topSpeed, car.baseStats.topSpeed)}
        ${generateStatHTML('Acceleration', stats.acceleration, car.baseStats.acceleration)}
        ${generateStatHTML('Braking', stats.braking, car.baseStats.braking)}
        ${generateStatHTML('Handling', stats.handling, car.baseStats.handling)}
        ${generateStatHTML('Dirt', stats.dirt, car.baseStats.dirt)}
        ${generateStatHTML('Tarmac', stats.tarmac, car.baseStats.tarmac)}
        <div class="condition-quick" style="margin-top:8px;">ENGINE ${Math.round(c.engine)}% · TIRES ${Math.round(c.tires)}% · SUSPENSION ${Math.round(c.suspension)}%</div>
    `;

    buildMaintenancePanel();
    renderCareerMode();
    if (document.getElementById('tab-tuning').classList.contains('active')) buildTuningShop();
}

function buildTuningShop() {
    const shopDiv = document.getElementById('tuning-categories');
    if (!selectedPlayerCar) {
        shopDiv.innerHTML = '';
        document.getElementById('shop-car-name').innerText = 'Select an owned car first';
        return;
    }

    document.getElementById('shop-car-name').innerText = selectedPlayerCar.name;
    shopDiv.innerHTML = '';

    for (const [category, items] of Object.entries(shopItems)) {
        let catDiv = document.createElement('div');
        catDiv.className = 'shop-category';

        let title = document.createElement('div');
        title.className = 'shop-cat-title';
        title.innerText = category.toUpperCase();
        catDiv.appendChild(title);

        let grid = document.createElement('div');
        grid.className = 'shop-grid';

        items.forEach(item => {
            let isOwned = selectedPlayerCar.upgrades.includes(item.id);
            let canAfford = playerData.money >= item.cost;

            let boostText = Object.entries(item.boosts)
                .map(([stat, val]) => `${val > 0 ? '+' : ''}${val} ${stat.charAt(0).toUpperCase() + stat.slice(1)}`)
                .join(', ');

            grid.innerHTML += `
                <div class="shop-item">
                    <div class="item-info">
                        <h4>${item.name}</h4>
                        <p>${boostText}</p>
                    </div>
                    <div class="item-buy">
                        <button class="${!isOwned && canAfford ? 'action-btn' : ''}"
                                ${isOwned || !canAfford ? 'disabled' : ''}
                                onclick="buyUpgrade('${item.id}', ${item.cost})">
                            ${isOwned ? 'Installed' : '$' + item.cost.toLocaleString()}
                        </button>
                    </div>
                </div>
            `;
        });
        catDiv.appendChild(grid);
        shopDiv.appendChild(catDiv);
    }
}

function buyUpgrade(itemId, cost) {
    if (playerData.money >= cost && selectedPlayerCar) {
        playerData.money -= cost;
        selectedPlayerCar.upgrades.push(itemId);
        updateHUD();
        buildTuningShop();
        buildGarage();
        selectCar(selectedPlayerCar);
        buildMaintenancePanel();
        saveGameState();
    }
}

function buildSkillTree() {
    const grid = document.getElementById('skill-grid');
    grid.innerHTML = '';

    for (const [key, skill] of Object.entries(playerData.skills)) {
        let cost = skill.baseCost * (skill.level + 1);
        let isMax = skill.level >= skill.max;
        let canAfford = playerData.money >= cost;

        grid.innerHTML += `
            <div class="skill-card">
                <div class="skill-action">
                    <div class="skill-level">${skill.level}</div>
                    <div class="skill-info">
                        <h3>${skill.name}</h3>
                        <p>${skill.desc}</p>
                        <span class="effect">${skill.effect}</span>
                    </div>
                </div>
                <div class="skill-buy">
                    <button class="${!isMax && canAfford ? 'action-btn' : ''}"
                            ${isMax || !canAfford ? 'disabled' : ''}
                            onclick="buySkill('${key}')">
                        ${isMax ? 'MAXED' : 'Upgrade: $' + cost.toLocaleString()}
                    </button>
                </div>
            </div>
        `;
    }
}

function buySkill(skillKey) {
    let skill = playerData.skills[skillKey];
    let cost = skill.baseCost * (skill.level + 1);

    if (playerData.money >= cost && skill.level < skill.max) {
        playerData.money -= cost;
        skill.level++;
        updateHUD();
        buildSkillTree();
        saveGameState();
    }
}
