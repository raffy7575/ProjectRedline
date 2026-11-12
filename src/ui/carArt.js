// Side-view car illustrations drawn as inline SVG, tinted with the car colour.

const BODIES = {
    hatch: 'M8 50 Q8 38 22 36 L52 22 Q60 18 78 18 L122 18 Q138 19 150 34 L176 38 Q190 40 191 50 L191 56 L8 56 Z',
    coupe: 'M6 50 Q6 40 24 37 L62 24 Q72 19 92 19 L118 19 Q136 21 156 35 L180 39 Q192 41 193 50 L193 56 L6 56 Z',
    sedan: 'M6 50 Q6 39 22 37 L48 36 L66 21 Q70 18 84 18 L124 18 Q134 18 140 23 L156 36 L182 38 Q192 40 193 50 L193 56 L6 56 Z',
    rally: 'M8 48 Q8 36 22 34 L50 20 Q58 16 76 16 L124 16 Q138 17 148 32 L176 35 Q190 37 191 48 L191 54 L8 54 Z',
    muscle: 'M4 50 Q4 38 20 36 L66 34 L84 21 Q88 18 100 18 L132 18 Q142 18 150 26 L160 35 L184 37 Q195 39 196 50 L196 56 L4 56 Z',
    super: 'M4 52 Q4 44 26 40 L74 26 Q84 21 102 21 L122 22 Q142 24 160 37 L184 41 Q195 43 196 52 L196 57 L4 57 Z'
};
const WINDOWS = {
    hatch: 'M58 24 L80 22 L80 35 L40 36 Z M86 22 L120 22 Q132 23 141 35 L86 35 Z',
    coupe: 'M68 26 L92 23 L92 36 L46 37 Z M98 23 L117 23 Q132 25 146 36 L98 36 Z',
    sedan: 'M70 23 L94 22 L94 35 L56 36 Z M100 22 L124 22 Q132 22 136 26 L146 36 L100 35 Z',
    rally: 'M56 22 L78 20 L78 33 L38 34 Z M84 20 L122 20 Q132 21 139 33 L84 33 Z',
    muscle: 'M88 23 L108 22 L108 34 L74 35 Z M114 22 L132 22 Q139 22 144 28 L150 35 L114 34 Z',
    super: 'M80 28 L102 25 L102 38 L58 39 Z M108 25 L121 26 Q138 28 150 38 L108 38 Z'
};

let gradientId = 0;

export function carSvg(body, color) {
    const b = BODIES[body] || BODIES.hatch;
    const w = WINDOWS[body] || WINDOWS.hatch;
    const ride = body === 'rally' ? 54 : body === 'super' ? 57 : 56;
    const id = `shade${gradientId++}`;
    const wingTop = body === 'super' ? 30 : 12;
    const wing = body === 'super' || body === 'rally'
        ? `<path d="M5 ${wingTop} h24 v3 h-9 v${body === 'super' ? 10 : 22} h-5 v-${body === 'super' ? 10 : 22} h-10 z" fill="#111"/>` : '';
    return `<svg class="car-art" viewBox="0 0 200 72" role="img" aria-label="${body} car">
        <ellipse cx="100" cy="66" rx="92" ry="5" fill="#000" opacity="0.45"/>
        ${wing}
        <path d="${b}" fill="${color}"/>
        <path d="${b}" fill="url(#${id})"/>
        <path d="${w}" fill="#0d1117" opacity="0.88"/>
        <rect x="6" y="${ride - 6}" width="188" height="3" fill="#000" opacity="0.28"/>
        <path d="M186 44 h7 v4 h-9 z" fill="#ffe9a8"/><path d="M6 42 h7 v5 h-7 z" fill="#ff3b2f"/>
        <circle cx="48" cy="${ride}" r="13" fill="#0a0a0c"/><circle cx="48" cy="${ride}" r="7" fill="#9aa0ab"/><circle cx="48" cy="${ride}" r="2.5" fill="#22252b"/>
        <circle cx="152" cy="${ride}" r="13" fill="#0a0a0c"/><circle cx="152" cy="${ride}" r="7" fill="#9aa0ab"/><circle cx="152" cy="${ride}" r="2.5" fill="#22252b"/>
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.32"/></linearGradient></defs>
    </svg>`;
}
