function completeInitialization() {
    updateHUD();
    rollRandomTrack();
    buildGarage();
    buildSkillTree();
    if (selectedPlayerCar) {
        selectCar(selectedPlayerCar);
    }
}

function openTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
    if (tabId === 'tab-tuning') buildTuningShop();
}

function updateHUD() {
    document.getElementById('player-name').innerText = playerData.name || 'Driver';
    document.getElementById('overlay-player-name').innerText = playerData.name || 'Driver';
    document.getElementById('player-money').innerText = playerData.money.toLocaleString();
}

function getCarStats(car) {
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
    return stats;
}

function rollRandomTrack() {
    let randomIndex = Math.floor(Math.random() * tracks.length);
    currentTrack = tracks[randomIndex];

    let dirtStr = currentTrack.dirt > 0 ? ` | <span style="color:#FF9800">${currentTrack.dirt * 100}% Dirt</span>` : ' | 100% Tarmac';
    document.getElementById('random-track-display').innerHTML = `
        ${currentTrack.name} <br>
        <span style="font-size: 0.8em; color: #aaa; font-weight: normal;">${currentTrack.laps} Laps${dirtStr}</span>
    `;
}

function buildGarage() {
    const grid = document.getElementById('car-grid');
    grid.innerHTML = '';

    cars.forEach(car => {
        let isOwned = playerData.ownedCars.includes(car.id);
        let stats = getCarStats(car);
        let card = document.createElement('div');

        card.className = `car-card ${isOwned ? 'owned' : ''}`;
        card.id = `card-${car.id}`;

        if (isOwned && selectedPlayerCar && selectedPlayerCar.id === car.id) card.classList.add('selected');
        if (isOwned) card.onclick = () => selectCar(car);

        let buyHTML = '';
        if (!isOwned) {
            let canAfford = playerData.money >= car.price;
            buyHTML = `
                <div class="buy-overlay">
                    <button class="buy-btn" ${!canAfford ? 'disabled' : ''} onclick="buyCar('${car.id}', ${car.price})">
                        Buy for $${car.price.toLocaleString()}
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="car-name"><span style="color:${car.color}">■</span> ${car.name}</div>
            ${generateStatHTML('Top Speed', stats.topSpeed, car.baseStats.topSpeed)}
            ${generateStatHTML('Acceleration', stats.acceleration, car.baseStats.acceleration)}
            ${generateStatHTML('Braking', stats.braking, car.baseStats.braking)}
            ${generateStatHTML('Handling', stats.handling, car.baseStats.handling)}
            ${generateStatHTML('Dirt', stats.dirt, car.baseStats.dirt)}
            ${buyHTML}
        `;
        grid.appendChild(card);
    });
}

function buyCar(carId, price) {
    if (playerData.money >= price) {
        playerData.money -= price;
        playerData.ownedCars.push(carId);
        updateHUD();
        let boughtCar = cars.find(c => c.id === carId);
        selectCar(boughtCar);
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
    document.getElementById('start-btn').style.display = 'block';

    let stats = getCarStats(car);
    document.getElementById('sidebar-car-name').innerText = car.name;
    document.getElementById('sidebar-car-name').style.color = car.color;
    document.getElementById('sidebar-stats').innerHTML = `
        ${generateStatHTML('Top Speed', stats.topSpeed, car.baseStats.topSpeed)}
        ${generateStatHTML('Acceleration', stats.acceleration, car.baseStats.acceleration)}
        ${generateStatHTML('Braking', stats.braking, car.baseStats.braking)}
        ${generateStatHTML('Handling', stats.handling, car.baseStats.handling)}
        ${generateStatHTML('Dirt', stats.dirt, car.baseStats.dirt)}
        ${generateStatHTML('Tarmac', stats.tarmac, car.baseStats.tarmac)}
    `;

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
