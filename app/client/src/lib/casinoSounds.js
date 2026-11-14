/**
 * Casino sounds, synthesized with Web Audio, except a few real ape recordings (public domain, see public/audio/monkeys/README.md)
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

/** White noise, made once and shared by every sound that needs breath or air */
let noiseBuffer = null;
function noise(ctx) {
    if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    return source;
}

/** Soft clipping: turns a clean buzz into a raw, strained throat */
const roughCurves = new Map();
function roughCurve(amount) {
    if (!roughCurves.has(amount)) {
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i / 255) * 2 - 1;
            curve[i] = Math.tanh(x * (1 + amount * 8));
        }
        roughCurves.set(amount, curve);
    }
    return roughCurves.get(amount);
}

/**
 * An ape call: a buzzing voice sliding between two pitches, shaped into a vowel. What makes it sound alive:
 * - breath mixed into the voice, through the same mouth
 * - a pitch that never holds still (jitter), and a shaky throat
 * - `rough` strains the voice, for screams and roars
 * - every call is a little higher or lower than the last, so no two sound the same
 */
function ape(ctx, at, { from, to, vowel, length, gain = 0.3, wobble = 18, breath = 0.35, rough = 0.3 }) {
    const pitch = APE_PITCH * (0.9 + Math.random() * 0.2);
    const voice = ctx.createOscillator();
    const shake = ctx.createOscillator();
    const shakeDepth = ctx.createGain();
    const throat = ctx.createWaveShaper();
    const air = noise(ctx);
    const airGain = ctx.createGain();
    const env = ctx.createGain();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(from * pitch, at);
    // Jitter: small random steps along the slide
    const steps = Math.max(2, Math.round(length / 0.03));
    for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const base = progress < 0.6 ? from + (to - from) * (progress / 0.6) : to * (1 - 0.15 * ((progress - 0.6) / 0.4));
        voice.frequency.linearRampToValueAtTime(base * pitch * (0.94 + Math.random() * 0.12), at + length * progress);
    }
    shake.frequency.value = 22 + Math.random() * 12;
    shakeDepth.gain.value = wobble;
    shake.connect(shakeDepth).connect(voice.frequency);
    throat.curve = roughCurve(rough);
    airGain.gain.value = breath;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.02);
    env.gain.setValueAtTime(gain, at + length * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    voice.connect(throat);
    air.connect(airGain);
    for (const frequency of VOWELS[vowel]) {
        const formant = ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.value = frequency * APE_MOUTH;
        formant.Q.value = 5;
        throat.connect(formant);
        airGain.connect(formant);
        formant.connect(env);
    }
    env.connect(master);
    [voice, shake, air].forEach((node) => {
        node.start(at);
        node.stop(at + length + 0.05);
    });
}

/**
 * Real ape recordings, and the slices of each worth hearing, as [start, length] in seconds.
 * Loaded once on first use: until then, the synthesized calls play instead
 */
const RECORDINGS = {
    'chimp-scream': {
        file: 'chimp-scream.mp3',
        gain: 2.5,
        slices: [
            [0.6, 0.7],
            [1.6, 0.45],
            [2.2, 0.9],
            [3.4, 0.85],
            [6.3, 0.9],
            [7.4, 0.9],
        ],
    },
    'chimp-cry': { file: 'chimp-cry.mp3', gain: 2, slices: [[1.1, 2]] },
    'gorilla-roar': { file: 'gorilla-roar.mp3', gain: 1, slices: [[0.05, 1.3]] },
    // The end of the build-up, then the screaming climax
    'chimp-pant-hoot': { file: 'chimp-pant-hoot.mp3', gain: 1.6, slices: [[5, 4]] },
};
const recordings = new Map();

/** Fetch and decode the ape recordings, so they are ready when the fight starts */
export function preloadApeRecordings() {
    const ctx = audio();
    if (!ctx) {
        return;
    }
    for (const [name, { file }] of Object.entries(RECORDINGS)) {
        if (!recordings.has(name)) {
            recordings.set(name, null);
            fetch(`/audio/monkeys/${file}`)
                .then((response) => response.arrayBuffer())
                .then((data) => ctx.decodeAudioData(data))
                .then((buffer) => recordings.set(name, buffer))
                .catch(() => recordings.delete(name));
        }
    }
}

/**
 * Play a random slice of a recording, a bit lower than life since lower sounds meaner. False when it isn't loaded yet
 */
function recording(ctx, at, name, { rate = 0.85 + Math.random() * 0.15, gain = 1 } = {}) {
    const buffer = recordings.get(name);
    if (!buffer) {
        return false;
    }
    const { slices, gain: level } = RECORDINGS[name];
    const [offset, length] = slices[Math.floor(Math.random() * slices.length)];
    const source = ctx.createBufferSource();
    const env = ctx.createGain();
    const heard = length / rate;
    source.buffer = buffer;
    source.playbackRate.value = rate;
    env.gain.setValueAtTime(level * gain, at);
    // A short fade, so the cut never clicks
    env.gain.setValueAtTime(level * gain, at + heard - 0.08);
    env.gain.linearRampToValueAtTime(0, at + heard);
    source.connect(env).connect(master);
    source.start(at, offset, length);
    return true;
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
        if (recording(ctx, at, 'chimp-cry')) {
            return;
        }
        ape(ctx, at, { from: 500, to: 900, vowel: 'ee', length: 0.14 });
        ape(ctx, at + 0.15, { from: 650, to: 1100, vowel: 'ee', length: 0.14 });
        ape(ctx, at + 0.32, { from: 900, to: 1500, vowel: 'ah', length: 0.38, gain: 0.4, rough: 0.9, breath: 0.5 });
    },
    hoot: (ctx, at) => {
        if (recording(ctx, at, 'chimp-pant-hoot', { rate: 0.92 })) {
            return;
        }
        [0, 0.16, 0.3, 0.42, 0.52].forEach((d, i) => ape(ctx, at + d, { from: 220 + i * 50, to: 300 + i * 60, vowel: 'oo', length: 0.12 }));
        ape(ctx, at + 0.64, { from: 700, to: 1000, vowel: 'ah', length: 0.3, gain: 0.35 });
        ape(ctx, at + 0.98, { from: 750, to: 1050, vowel: 'ah', length: 0.32, gain: 0.35 });
    },
    grunt: (ctx, at) => ape(ctx, at, { from: 170, to: 120, vowel: 'oo', length: 0.14, gain: 0.35, breath: 0.6, rough: 0.5 }),
    yelp: (ctx, at) => ape(ctx, at, { from: 900, to: 1300, vowel: 'ah', length: 0.13, gain: 0.25 }),
    scream: (ctx, at) =>
        recording(ctx, at, 'chimp-scream') ||
        ape(ctx, at, { from: 1100, to: 1700, vowel: 'ee', length: 0.4, gain: 0.35, wobble: 40, rough: 0.9, breath: 0.5 }),
    // A bomb: a crack, then a long low rumble
    boom: (ctx, at) => {
        swish(ctx, at, 0.06, { from: 4000, to: 1500, gain: 0.6 });
        swish(ctx, at, 1.2, { from: 900, to: 60, gain: 0.9 });
        tone(ctx, at, 70, 1.4, { type: 'sine', gain: 0.8, slideTo: 25 });
    },
    chatter: (ctx, at) =>
        [0, 0.08, 0.16, 0.24].forEach((d, i) => ape(ctx, at + d, { from: 700 + i * 60, to: 950, vowel: 'ah', length: 0.07, gain: 0.22 })),
    ooh: (ctx, at) => ape(ctx, at, { from: 260, to: 380, vowel: 'oo', length: 0.22, gain: 0.3 }),
    chestbeat: (ctx, at) =>
        [0, 0.09, 0.18, 0.27, 0.36, 0.45, 0.54].forEach((d) => tone(ctx, at + d, 95, 0.1, { type: 'sine', gain: 0.55, slideTo: 60 })),
    // Monkey Fight traits: the gorilla's roar, a coconut on a skull, a throw, a vampire's sip, a ninja's smoke, a counter's blade, a zombie rising, and the birds of a stunned head
    roar: (ctx, at) => {
        if (!recording(ctx, at, 'gorilla-roar', { rate: 0.9 })) {
            ape(ctx, at, { from: 150, to: 110, vowel: 'ah', length: 0.8, gain: 0.45, wobble: 30, breath: 0.6, rough: 1 });
            swish(ctx, at, 0.9, { from: 400, to: 80, gain: 0.5 });
        }
        [0.85, 0.94, 1.03, 1.12].forEach((d) => tone(ctx, at + d, 90, 0.1, { type: 'sine', gain: 0.55, slideTo: 55 }));
    },
    bonk: (ctx, at) => {
        tone(ctx, at, 540, 0.06, { type: 'square', gain: 0.18 });
        tone(ctx, at, 260, 0.16, { type: 'sine', gain: 0.5, slideTo: 170 });
        swish(ctx, at, 0.05, { from: 2500, to: 900, gain: 0.3 });
    },
    throw: (ctx, at) => swish(ctx, at, 0.2, { from: 500, to: 2600, gain: 0.25 }),
    slurp: (ctx, at) => [0, 0.09, 0.2].forEach((d, i) => swish(ctx, at + d, 0.09 + i * 0.03, { from: 350, to: 1300, gain: 0.35 })),
    poof: (ctx, at) => swish(ctx, at, 0.4, { from: 2600, to: 250, gain: 0.45 }),
    slash: (ctx, at) => {
        swish(ctx, at, 0.12, { from: 7000, to: 2200, gain: 0.5 });
        tone(ctx, at, 1900, 0.15, { type: 'sine', gain: 0.12, slideTo: 900 });
        swish(ctx, at + 0.08, 0.1, { from: 900, to: 200, gain: 0.6 });
    },
    revive: (ctx, at) => {
        tone(ctx, at, 110, 1, { type: 'sawtooth', gain: 0.08, slideTo: 330 });
        ape(ctx, at + 0.1, { from: 120, to: 170, vowel: 'oo', length: 0.9, gain: 0.35, wobble: 25, breath: 0.7, rough: 0.6 });
    },
    dizzy: (ctx, at) =>
        [0, 0.12, 0.24, 0.36].forEach((d, i) =>
            tone(ctx, at + d, i % 2 ? 2300 : 1900, 0.09, { type: 'sine', gain: 0.1, slideTo: i % 2 ? 2900 : 2500 }),
        ),
    // Lucky Pop: ice cracking over the sky, and a twinkle when the patience balloon turns up
    freeze: (ctx, at) => {
        [0, 0.05, 0.13].forEach((d) => swish(ctx, at + d, 0.06, { from: 6000, to: 3000, gain: 0.35 }));
        [1568, 2093, 2637, 3136].forEach((f, i) => tone(ctx, at + 0.1 + i * 0.07, f, 0.8, { type: 'sine', gain: 0.07 }));
    },
    sparkle: (ctx, at) => [1319, 1760, 2349, 2637, 3520].forEach((f, i) => tone(ctx, at + i * 0.06, f, 0.5, { type: 'sine', gain: 0.08 })),
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
