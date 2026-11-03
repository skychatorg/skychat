/**
 * Casino sounds, synthesized with Web Audio so there are no files to load or license
 */

let context = null;
let master = null;

function audio() {
    if (!context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            return null;
        }
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = 0.3;
        master.connect(context.destination);
    }
    if (context.state === 'suspended') {
        context.resume().catch(() => {});
    }
    return context;
}

/** A note with a soft attack and decay */
function tone(ctx, at, freq, duration, { type = 'triangle', gain = 0.25, slideTo = null } = {}) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
    }
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env).connect(master);
    osc.start(at);
    osc.stop(at + duration + 0.05);
}

/** Filtered noise, sweeping between two frequencies: the sound of paper or felt */
function swish(ctx, at, duration, { from = 3000, to = 900, gain = 0.35 } = {}) {
    const samples = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + duration);
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(env).connect(master);
    source.start(at);
}

const SOUNDS = {
    deal: (ctx, at) => swish(ctx, at, 0.12),
    flip: (ctx, at) => {
        swish(ctx, at, 0.09, { from: 1800, to: 4200, gain: 0.3 });
        tone(ctx, at + 0.08, 180, 0.06, { type: 'sine', gain: 0.2 });
    },
    // Two clay chips clicking together, then landing on the felt
    chip: (ctx, at) => {
        tone(ctx, at, 2600, 0.05, { type: 'square', gain: 0.06 });
        tone(ctx, at + 0.05, 3300, 0.05, { type: 'square', gain: 0.05 });
        tone(ctx, at + 0.08, 140, 0.12, { type: 'sine', gain: 0.25 });
    },
    win: (ctx, at) => [523.25, 659.25, 783.99].forEach((f, i) => tone(ctx, at + i * 0.09, f, 0.5, { gain: 0.18 })),
    blackjack: (ctx, at) => {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ctx, at + i * 0.08, f, 0.7, { gain: 0.18 }));
        [2093, 2637, 3136].forEach((f, i) => tone(ctx, at + 0.35 + i * 0.06, f, 0.6, { type: 'sine', gain: 0.05 }));
    },
    push: (ctx, at) => tone(ctx, at, 440, 0.35, { type: 'sine', gain: 0.15 }),
    lose: (ctx, at) => {
        tone(ctx, at, 293.66, 0.35, { type: 'sine', gain: 0.18 });
        tone(ctx, at + 0.18, 220, 0.5, { type: 'sine', gain: 0.18, slideTo: 196 });
    },
    // A wooden tick for the last seconds of your turn
    tick: (ctx, at) => tone(ctx, at, 900, 0.04, { type: 'sine', gain: 0.12 }),
    pop: (ctx, at) => {
        swish(ctx, at, 0.05, { from: 1200, to: 300, gain: 0.5 });
        tone(ctx, at, 160, 0.08, { type: 'sine', gain: 0.25, slideTo: 60 });
    },
};

/**
 * Play a casino sound, after delayMs. Sound is a nicety: it never throws
 */
export function playCasinoSound(name, delayMs = 0) {
    try {
        const ctx = audio();
        if (ctx) {
            SOUNDS[name](ctx, ctx.currentTime + delayMs / 1000);
        }
    } catch {
        // No audio on this device
    }
}

/**
 * Browsers start audio suspended until the user interacts with the page
 */
export function unlockCasinoSound() {
    try {
        audio();
    } catch {
        // No audio on this device
    }
}
