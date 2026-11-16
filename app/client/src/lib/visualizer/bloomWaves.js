// Bloom + Waves: soft rings around a round cover (bass, mids, highs) over waves along the floor, with sparks on kicks

const TAU = Math.PI * 2;
// Below this height the player is in its small size: one ring, lower waves
const SMALL_HEIGHT = 140;
// Turntable-like rotation of the disc, in turns per second
const SPIN_SPEED = 0.08;

/**
 * Create the drawing state for one canvas. The returned function draws one frame.
 * @returns {(ctx: CanvasRenderingContext2D, frame: Frame) => void}
 *
 * @typedef {object} Frame
 * @property {number} width
 * @property {number} height
 * @property {Float32Array} bands Loudness per band, 0 to 1, low to high
 * @property {string[]} palette Three CSS colors from the cover
 * @property {HTMLImageElement|null} cover
 * @property {{ x: number, y: number, r: number }} disc Where the cover disc goes, in canvas pixels
 * @property {number} dt Seconds since the previous frame, 0 when paused
 */
export function createBloomWaves() {
    const sparks = [];
    let spin = 0;
    let bassAverage = 0;
    let sinceKick = 1;

    return (ctx, { width: w, height: h, bands, palette, cover, disc, dt }) => {
        const small = h < SMALL_HEIGHT;
        const sample = (f) => bands[Math.min(bands.length - 1, Math.floor(f * bands.length))];
        const level = (from, to) => {
            let sum = 0;
            for (let i = from; i < to; i++) sum += bands[i];
            return sum / (to - from);
        };
        const bass = level(0, Math.ceil(bands.length / 8));

        // A kick is a bass jump well above its recent average, at most a few per second
        spin += dt * SPIN_SPEED * TAU;
        sinceKick += dt;
        const kick = dt > 0 && bass > 0.35 && bass > bassAverage * 1.25 && sinceKick > 0.25;
        if (kick) sinceKick = 0;
        bassAverage += (bass - bassAverage) * Math.min(1, dt * 4);

        ctx.clearRect(0, 0, w, h);
        drawWaves(ctx, w, h, sample, palette, spin, small);
        if (kick) {
            for (let i = 0; i < (small ? 5 : 10); i++) sparks.push(newSpark(w, h, palette[i % palette.length]));
        }
        drawSparks(ctx, sparks, dt);
        drawRings(ctx, disc, bands, palette, spin, small);
        drawDisc(ctx, disc, cover, spin, bass, Math.exp(-sinceKick * 8));
    };
}

function drawWaves(ctx, w, h, sample, palette, spin, small) {
    const layers = [
        { color: palette[2], alpha: 0.55, scale: 1.3, offset: 0 },
        { color: palette[0], alpha: 0.6, scale: 1.0, offset: 1.7 },
        { color: palette[1], alpha: 0.65, scale: 0.75, offset: 3.1 },
    ];
    const points = 48;
    for (const { color, alpha, scale, offset } of layers) {
        const gradient = ctx.createLinearGradient(0, h * 0.3, 0, h);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i <= points; i++) {
            // Each layer reads the spectrum from a different starting point, drifting slowly
            const v = sample((i / points + offset * 0.13 + spin * 0.01) % 1);
            const swell = Math.sin(i * 0.5 + spin * 2 + offset) * 6;
            ctx.lineTo((i / points) * w, h - (0.1 + v * scale) * h * (small ? 0.9 : 0.6) - swell);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = gradient;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function newSpark(w, h, color) {
    return {
        x: Math.random() * w,
        y: h * (0.65 + Math.random() * 0.3),
        vx: (Math.random() - 0.5) * 36,
        vy: -60 - Math.random() * 120,
        life: 1,
        color,
    };
}

// Sparks rise, slow down and fade out over about a second
function drawSparks(ctx, sparks, dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.vx *= Math.pow(0.16, dt);
        spark.vy = spark.vy * Math.pow(0.16, dt) + 36 * dt;
        spark.life -= dt * 1.1;
        if (spark.life <= 0) {
            sparks.splice(i, 1);
            continue;
        }
        ctx.globalAlpha = spark.life;
        ctx.fillStyle = spark.color;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 2.2, 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// One soft ring per band range, each turning at its own speed
function drawRings(ctx, disc, bands, palette, spin, small) {
    const n = bands.length;
    const rings = small
        ? [{ from: 0, to: n / 5, grow: 0.35, size: 1.03, turn: 1.5, color: palette[0], alpha: 0.6 }]
        : [
              { from: n * 0.6, to: n - 1, grow: 2.2, size: 1.15, turn: 0.6, color: palette[2], alpha: 0.35 },
              { from: n / 5, to: n * 0.6, grow: 1.4, size: 1.08, turn: -1, color: palette[1], alpha: 0.45 },
              { from: 0, to: n / 5, grow: 0.8, size: 1.03, turn: 1.5, color: palette[0], alpha: 0.6 },
          ];
    ctx.save();
    ctx.filter = 'blur(2px)';
    for (const ring of rings) {
        const points = 64;
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
            // Mirrored around the circle, so the shape closes without a seam
            const k = i % points;
            const half = k < points / 2 ? k : points - k;
            const v = bands[Math.floor(ring.from + ((ring.to - ring.from) * half) / (points / 2))];
            const radius = disc.r * ring.size + v * disc.r * ring.grow;
            const angle = (k / points) * TAU + spin * ring.turn;
            const x = disc.x + Math.cos(angle) * radius;
            const y = disc.y + Math.sin(angle) * radius;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.globalAlpha = ring.alpha;
        ctx.fillStyle = ring.color;
        ctx.fill();
    }
    ctx.restore();
}

function drawDisc(ctx, disc, cover, spin, bass, kickPulse) {
    const r = disc.r * (1 + kickPulse * 0.03);
    ctx.save();
    ctx.translate(disc.x, disc.y);
    ctx.rotate(spin);
    ctx.shadowColor = `rgba(0, 0, 0, ${0.4 + bass * 0.3})`;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.shadowBlur = 0;
    if (cover) {
        ctx.clip();
        ctx.drawImage(cover, -r, -r, r * 2, r * 2);
    }
    ctx.restore();
}
