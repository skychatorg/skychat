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

/** Mouth shapes for the ape voice: the two resonances that make a buzz sound like a vowel */
const VOWELS = { oo: [320, 800], ah: [750, 1150], ee: [400, 2200] };

/** Lower is meaner: every ape voice plays at this share of its pitch, through a slightly bigger mouth */
const APE_PITCH = 0.55;
const APE_MOUTH = 0.85;

/**
 * An ape call: a buzzing voice that slides between two pitches, shaped into a vowel, with a shaky throat
 */
function ape(ctx, at, { from, to, vowel, length, gain = 0.3, wobble = 18 }) {
    const voice = ctx.createOscillator();
    const shake = ctx.createOscillator();
    const shakeDepth = ctx.createGain();
    const env = ctx.createGain();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(from * APE_PITCH, at);
    voice.frequency.linearRampToValueAtTime(to * APE_PITCH, at + length * 0.6);
    voice.frequency.linearRampToValueAtTime(to * APE_PITCH * 0.85, at + length);
    shake.frequency.value = 28;
    shakeDepth.gain.value = wobble;
    shake.connect(shakeDepth).connect(voice.frequency);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.02);
    env.gain.setValueAtTime(gain, at + length * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    for (const frequency of VOWELS[vowel]) {
        const formant = ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.value = frequency * APE_MOUTH;
        formant.Q.value = 5;
        voice.connect(formant).connect(env);
    }
    env.connect(master);
    voice.start(at);
    shake.start(at);
    voice.stop(at + length + 0.05);
    shake.stop(at + length + 0.05);
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
    // Monkey Fight: a body blow, a bone-cracking crit, a swing in the air, a banana, the bell and the screech
    punch: (ctx, at) => {
        swish(ctx, at, 0.08, { from: 900, to: 200, gain: 0.6 });
        tone(ctx, at, 130, 0.14, { type: 'sine', gain: 0.5, slideTo: 45 });
    },
    smash: (ctx, at) => {
        swish(ctx, at, 0.04, { from: 5000, to: 2500, gain: 0.5 });
        swish(ctx, at + 0.01, 0.16, { from: 700, to: 120, gain: 0.8 });
        tone(ctx, at, 95, 0.3, { type: 'sine', gain: 0.7, slideTo: 32 });
    },
    whoosh: (ctx, at) => swish(ctx, at, 0.22, { from: 300, to: 2200, gain: 0.3 }),
    chomp: (ctx, at) => [0, 0.11, 0.22].forEach((d) => swish(ctx, at + d, 0.05, { from: 1400, to: 700, gain: 0.35 })),
    bell: (ctx, at) =>
        [0, 0.35].forEach((d) =>
            [523, 1210, 1690, 2380].forEach((f, i) => tone(ctx, at + d, f, 1.4 - i * 0.2, { type: 'sine', gain: 0.12 / (i + 1) })),
        ),
    // Apes: a pant-hoot that climbs into a scream, grunts, yelps and a chest beat
    screech: (ctx, at) => {
        ape(ctx, at, { from: 500, to: 900, vowel: 'ee', length: 0.14 });
        ape(ctx, at + 0.15, { from: 650, to: 1100, vowel: 'ee', length: 0.14 });
        ape(ctx, at + 0.32, { from: 900, to: 1500, vowel: 'ah', length: 0.38, gain: 0.4 });
    },
    hoot: (ctx, at) => {
        [0, 0.16, 0.3, 0.42, 0.52].forEach((d, i) => ape(ctx, at + d, { from: 220 + i * 50, to: 300 + i * 60, vowel: 'oo', length: 0.12 }));
        ape(ctx, at + 0.64, { from: 700, to: 1000, vowel: 'ah', length: 0.3, gain: 0.35 });
        ape(ctx, at + 0.98, { from: 750, to: 1050, vowel: 'ah', length: 0.32, gain: 0.35 });
    },
    grunt: (ctx, at) => ape(ctx, at, { from: 170, to: 120, vowel: 'oo', length: 0.14, gain: 0.35 }),
    yelp: (ctx, at) => ape(ctx, at, { from: 900, to: 1300, vowel: 'ah', length: 0.13, gain: 0.25 }),
    scream: (ctx, at) => ape(ctx, at, { from: 1100, to: 1700, vowel: 'ee', length: 0.4, gain: 0.35, wobble: 40 }),
    chatter: (ctx, at) =>
        [0, 0.08, 0.16, 0.24].forEach((d, i) => ape(ctx, at + d, { from: 700 + i * 60, to: 950, vowel: 'ah', length: 0.07, gain: 0.22 })),
    ooh: (ctx, at) => ape(ctx, at, { from: 260, to: 380, vowel: 'oo', length: 0.22, gain: 0.3 }),
    chestbeat: (ctx, at) =>
        [0, 0.09, 0.18, 0.27, 0.36, 0.45, 0.54].forEach((d) => tone(ctx, at + d, 95, 0.1, { type: 'sine', gain: 0.55, slideTo: 60 })),
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

/** Two seconds of brown noise, looped: deep and soft, like air rushing past */
let brown = null;
function brownNoise(ctx) {
    if (!brown) {
        brown = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = brown.getChannelData(0);
        let last = 0;
        for (let i = 0; i < data.length; i++) {
            last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
            data[i] = last * 3.5;
        }
    }
    const source = ctx.createBufferSource();
    source.buffer = brown;
    source.loop = true;
    return source;
}

/**
 * The sound of a Crash flight: wind that opens up and gets louder with `intensity` (0 to 1),
 * gusting on its own so it never sounds like a held note, and a low rumble that only comes in late.
 * Never throws: on a device without audio every method does nothing
 */
export function createFlightSound() {
    const silent = { set() {}, whoosh() {}, stop() {} };
    let ctx;
    try {
        ctx = audio();
    } catch {
        return silent;
    }
    if (!ctx) {
        return silent;
    }
    const now = ctx.currentTime;

    const wind = brownNoise(ctx);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.Q.value = 0.8;
    windFilter.frequency.value = 300;
    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0, now);
    windGain.gain.linearRampToValueAtTime(0.05, now + 0.6);
    // Gusts: a slow wobble on the filter
    const gust = ctx.createOscillator();
    const gustDepth = ctx.createGain();
    gust.frequency.value = 0.23;
    gustDepth.gain.value = 120;
    gust.connect(gustDepth).connect(windFilter.frequency);
    wind.connect(windFilter).connect(windGain).connect(master);

    const rumble = brownNoise(ctx);
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 90;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    rumble.connect(rumbleFilter).connect(rumbleGain).connect(master);

    const sources = [wind, rumble, gust];
    sources.forEach((source) => source.start(now));
    let stopped = false;
    let windLevel = 0.05;

    return {
        set(intensity) {
            if (stopped) {
                return;
            }
            const t = ctx.currentTime;
            windLevel = 0.05 + 0.3 * intensity;
            windFilter.frequency.setTargetAtTime(300 + 2700 * intensity ** 1.4, t, 0.3);
            gustDepth.gain.setTargetAtTime(120 + 600 * intensity, t, 0.3);
            windGain.gain.setTargetAtTime(windLevel, t, 0.3);
            rumbleGain.gain.setTargetAtTime(Math.max(0, intensity - 0.45) * 0.9, t, 0.5);
        },
        /** A swell of wind, for a milestone */
        whoosh() {
            if (stopped) {
                return;
            }
            const t = ctx.currentTime;
            windGain.gain.cancelScheduledValues(t);
            windGain.gain.setTargetAtTime(windLevel * 2.2, t, 0.08);
            windGain.gain.setTargetAtTime(windLevel, t + 0.35, 0.4);
            swish(ctx, t, 0.6, { from: 500, to: 2600, gain: 0.25 });
        },
        /** Silence, cut dead and then a muffled thud when it crashed, faded otherwise */
        stop(crashed = false) {
            if (stopped) {
                return;
            }
            stopped = true;
            const t = ctx.currentTime;
            const fade = crashed ? 0.02 : 0.4;
            [windGain, rumbleGain].forEach((gain) => {
                gain.gain.cancelScheduledValues(t);
                gain.gain.setTargetAtTime(0, t, fade / 3);
            });
            sources.forEach((source) => source.stop(t + fade + 0.1));
            if (crashed) {
                tone(ctx, t + 0.04, 80, 0.7, { type: 'sine', gain: 0.5, slideTo: 32 });
                swish(ctx, t + 0.04, 0.35, { from: 600, to: 120, gain: 0.4 });
            }
        },
    };
}

/**
 * A crowd around the fight pit: a low murmur that never stops while it plays, and a roar on demand.
 * Never throws: on a device without audio every method does nothing
 */
export function createCrowdSound() {
    const silent = { roar() {}, stop() {} };
    let ctx;
    try {
        ctx = audio();
    } catch {
        return silent;
    }
    if (!ctx) {
        return silent;
    }
    const now = ctx.currentTime;
    const crowd = brownNoise(ctx);
    const voices = ctx.createBiquadFilter();
    voices.type = 'bandpass';
    voices.frequency.value = 520;
    voices.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 1);
    // The murmur rises and falls on its own, like people talking over each other
    const sway = ctx.createOscillator();
    const swayDepth = ctx.createGain();
    sway.frequency.value = 0.4;
    swayDepth.gain.value = 0.05;
    sway.connect(swayDepth).connect(gain.gain);
    crowd.connect(voices).connect(gain).connect(master);
    crowd.start(now);
    sway.start(now);
    let stopped = false;
    return {
        roar(strength = 1) {
            if (stopped) {
                return;
            }
            const t = ctx.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setTargetAtTime(0.18 + 0.5 * strength, t, 0.06);
            gain.gain.setTargetAtTime(0.18, t + 0.5 + strength * 0.6, 0.5);
            voices.frequency.setTargetAtTime(700 + 400 * strength, t, 0.05);
            voices.frequency.setTargetAtTime(520, t + 0.6, 0.4);
        },
        stop() {
            if (stopped) {
                return;
            }
            stopped = true;
            const t = ctx.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setTargetAtTime(0, t, 0.4);
            crowd.stop(t + 2);
            sway.stop(t + 2);
        },
    };
}
