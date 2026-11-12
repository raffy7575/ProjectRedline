// Sound, synthesised with WebAudio (no audio files to load).
// Browsers only allow audio after a user gesture, so everything is created
// lazily on the first call that follows a click or key press.

let ctx = null;
let master = null;
let engine = null;
let enabled = true;

function ensure() {
    if (!enabled) return null;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

export function setSoundEnabled(on) {
    enabled = !!on;
    if (!enabled) stopEngine();
}

export function beep(freq = 440, duration = 0.12, type = 'square', volume = 0.25) {
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ac.currentTime + duration + 0.02);
}

export const sfx = {
    click: () => beep(520, 0.05, 'triangle', 0.12),
    buy: () => { beep(660, 0.08, 'triangle', 0.2); setTimeout(() => beep(990, 0.14, 'triangle', 0.2), 80); },
    error: () => beep(160, 0.16, 'sawtooth', 0.15),
    light: () => beep(440, 0.14, 'square', 0.18),
    go: () => beep(880, 0.5, 'square', 0.22),
    good: () => { beep(784, 0.1, 'triangle', 0.2); setTimeout(() => beep(1175, 0.2, 'triangle', 0.2), 100); },
    bad: () => beep(140, 0.3, 'sawtooth', 0.2),
    win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'triangle', 0.22), i * 130))
};

export function startEngine() {
    const ac = ensure();
    if (!ac || engine) return;
    const osc = ac.createOscillator();
    const sub = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    sub.type = 'square';
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    gain.gain.value = 0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(master);
    osc.start();
    sub.start();

    // Nitro hiss / tyre squeal: filtered noise, silent until needed.
    const buffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = ac.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2400;
    const noiseGain = ac.createGain();
    noiseGain.gain.value = 0;
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start();

    engine = { osc, sub, filter, gain, noise, noiseGain };
}

/** rpmFraction, throttle and slide are 0..1; nitro is a boolean. */
export function updateEngine(rpmFraction, throttle, nitro, slide) {
    if (!engine || !ctx) return;
    const t = ctx.currentTime;
    const freq = 45 + rpmFraction * 190;
    engine.osc.frequency.setTargetAtTime(freq, t, 0.03);
    engine.sub.frequency.setTargetAtTime(freq / 2, t, 0.03);
    engine.filter.frequency.setTargetAtTime(350 + rpmFraction * 1500 + throttle * 600, t, 0.05);
    engine.gain.gain.setTargetAtTime(0.05 + throttle * 0.07, t, 0.05);
    engine.noiseGain.gain.setTargetAtTime((nitro ? 0.16 : 0) + slide * 0.08, t, 0.05);
}

export function stopEngine() {
    if (!engine) return;
    try {
        engine.osc.stop();
        engine.sub.stop();
        engine.noise.stop();
    } catch { /* already stopped */ }
    engine = null;
}
