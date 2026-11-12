// Tiny DOM helpers shared by every screen.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => ESCAPES[ch]);
}

export const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

/** 83.456 -> "1:23.46" */
export function fmtTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function ordinal(n) {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

export function toast(text, kind = 'info', ms = 3600) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    root.appendChild(el);
    while (root.children.length > 4) root.firstChild.remove();
    setTimeout(() => el.remove(), ms);
}

/** Show a modal. Clicks on [data-action] inside are handled by the global handler. */
export function openModal(html, { wide = false, dismissable = true } = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="overlay" ${dismissable ? 'data-dismiss="1"' : ''}><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
    const focusable = root.querySelector('input, textarea, .btn.primary, button');
    if (focusable) focusable.focus();
}

export function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
}

export function isModalOpen() {
    return !!document.getElementById('modal-root').firstChild;
}
