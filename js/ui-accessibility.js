function getTabButtonForPanel(panelId) {
    return document.querySelector(`.tab-btn[data-tab="${panelId}"]`);
}

/* ── ARIA live region ───────────────────────────────────────────────────────
   A single off-screen polite region is used for all announcements.
   Call announce(message) to queue a screen-reader notification.
─────────────────────────────────────────────────────────────────────────── */
let _liveRegion = null;

function getLiveRegion() {
    if (_liveRegion) return _liveRegion;
    _liveRegion = document.createElement('div');
    _liveRegion.id = 'sr-announcer';
    _liveRegion.setAttribute('role', 'status');
    _liveRegion.setAttribute('aria-live', 'polite');
    _liveRegion.setAttribute('aria-atomic', 'true');
    Object.assign(_liveRegion.style, {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        border: '0',
    });
    document.body.appendChild(_liveRegion);
    return _liveRegion;
}

function announce(message) {
    const region = getLiveRegion();
    // Clear, then set on next tick so repeated identical strings still trigger
    region.textContent = '';
    requestAnimationFrame(() => { region.textContent = message; });
}

function syncTabAccessibility(activePanelId) {
    const tabButtons = Array.from(document.querySelectorAll('.tab-btn[data-tab]'));
    const panels = Array.from(document.querySelectorAll('.tab-content[id]'));

    tabButtons.forEach(btn => {
        const controlsId = btn.getAttribute('data-tab');
        const isActive = controlsId === activePanelId;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-controls', controlsId);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.forEach(panel => {
        panel.setAttribute('role', 'tabpanel');
        const controller = getTabButtonForPanel(panel.id);
        if (controller && controller.id) {
            panel.setAttribute('aria-labelledby', controller.id);
        }
        const isActive = panel.id === activePanelId;
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        panel.toggleAttribute('hidden', !isActive);
    });

    // Announce the newly active tab label to screen readers
    const activeBtn = tabButtons.find(b => b.getAttribute('data-tab') === activePanelId);
    if (activeBtn) {
        const label = activeBtn.textContent.replace(/🔒\s*/g, '').trim();
        announce(`${label} tab selected`);
    }
}

function initTabAccessibility() {
    const tabList = document.querySelector('.nav-tabs');
    if (!tabList) return;

    tabList.setAttribute('role', 'tablist');
    if (!tabList.getAttribute('aria-label')) {
        tabList.setAttribute('aria-label', 'Main navigation tabs');
    }

    const tabButtons = Array.from(document.querySelectorAll('.tab-btn[data-tab]'));
    tabButtons.forEach((btn, index) => {
        if (!btn.id) btn.id = `main-tab-${index + 1}`;

        btn.addEventListener('keydown', (event) => {
            const navKeys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
            if (!navKeys.includes(event.key)) return;
            event.preventDefault();

            let targetIndex = index;
            if (event.key === 'ArrowRight') targetIndex = (index + 1) % tabButtons.length;
            if (event.key === 'ArrowLeft') targetIndex = (index - 1 + tabButtons.length) % tabButtons.length;
            if (event.key === 'Home') targetIndex = 0;
            if (event.key === 'End') targetIndex = tabButtons.length - 1;

            const targetBtn = tabButtons[targetIndex];
            if (!targetBtn) return;

            const panelId = targetBtn.getAttribute('data-tab');
            if (typeof openTab === 'function' && panelId) {
                openTab(panelId, targetBtn);
            }
            targetBtn.focus();
        });
    });

    const activeButton = tabButtons.find(btn => btn.classList.contains('active')) || tabButtons[0];
    if (activeButton) {
        const panelId = activeButton.getAttribute('data-tab');
        if (panelId) syncTabAccessibility(panelId);
    }
}
