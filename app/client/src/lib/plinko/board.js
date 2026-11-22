import { PLINKO, PLINKO_SLOTS, plinkoTimes } from '../../../../api/plinko.ts';

const TAU = Math.PI * 2;
const ROWS = PLINKO.rows;
// Below this height the board drops its stars and slot labels
const SMALL_HEIGHT = 160;

/** A ball's color from its owner's name, so each player keeps one color */
export function ballColor(username) {
    let hash = 0;
    for (const char of username) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return `hsl(${Math.abs(hash) % 360}, 85%, 68%)`;
}

const SLOT_STYLE = {
    jackpot: { fill: ['#ffe9a3', '#f4c44e', '#b8862a'], text: '#2a1c04', label: '★' },
    5: { fill: ['#ff9bd2', '#c45aa0'], text: '#fff', label: '5×' },
    2: { fill: ['#a99bff', '#6b5ad6'], text: '#fff', label: '2×' },
    1: { fill: ['#7fd4e8', '#3d8fa8'], text: '#fff', label: '1×' },
    0.5: { fill: ['#5f6688', '#3c4060'], text: '#e8e8ff', label: '½×' },
    0: { fill: ['#2c2c44', '#1e1e30'], text: '#8a8aa8', label: '0' },
};

/**
 * The Plinko board on a canvas. Balls are drawn from their path and the time since they were dropped,
 * so every viewer sees the same fall. `draw` returns what happened since the last frame (peg hits, landings).
 */
export function createPlinkoBoard() {
    const stars = Array.from({ length: 70 }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: 0.4 + Math.random() * 1.2,
        phase: Math.random() * TAU,
    }));
    const glows = new Map();
    const trails = new Map();
    const seen = new Map();
    let geo = null;

    function layout(width, height) {
        const small = height < SMALL_HEIGHT;
        const top = small ? 8 : 14;
        const slotH = Math.max(14, Math.min(30, height * 0.07));
        const rowH = (height - top - slotH - 14) / ROWS;
        // Wider than tall when the player is short, so the board fills its width
        const spacing = Math.min(width / (PLINKO_SLOTS.length + 0.4), rowH * 2.4);
        geo = {
            width,
            height,
            small,
            top,
            rowH,
            spacing,
            slotH,
            x0: width / 2,
            slotY: top + rowH * ROWS + 6,
            peg: Math.max(1.6, spacing * 0.08),
            ball: Math.max(3, spacing * 0.19),
        };
    }

    const pegAt = (row, col) => ({ x: geo.x0 + (col - row / 2) * geo.spacing, y: geo.top + row * geo.rowH });
    // Where a ball rests on top of the peg it is about to hit
    const ballAt = (row, rights) => {
        const peg = pegAt(row, rights);
        return { x: peg.x, y: peg.y - geo.ball - geo.peg };
    };

    function ballPosition(ball, elapsed) {
        const times = ball.times;
        let row = 0;
        while (row < ROWS && elapsed >= times[row + 1]) row++;
        let rights = 0;
        for (let r = 0; r < row; r++) rights += ball.path[r] ? 1 : 0;
        if (row >= ROWS) {
            const end = ballAt(ROWS, rights);
            const fall = Math.min(1, (elapsed - times[ROWS]) / 150);
            return { row, rights, x: end.x, y: end.y + fall * (geo.slotY + geo.slotH / 2 - end.y), landed: fall >= 1 };
        }
        const frac = Math.max(0, Math.min(1, (elapsed - times[row]) / (times[row + 1] - times[row])));
        const a = ballAt(row, rights);
        const b = ballAt(row + 1, rights + (ball.path[row] ? 1 : 0));
        // A little hop off the peg, then the fall to the next one
        return {
            row,
            rights,
            x: a.x + (b.x - a.x) * frac,
            y: a.y + (b.y - a.y) * frac * frac - Math.sin(frac * Math.PI) * geo.rowH * 0.3,
            landed: false,
        };
    }

    function drawSky(ctx, now) {
        const { width, height } = geo;
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#0d0a24');
        sky.addColorStop(0.6, '#1a0f3a');
        sky.addColorStop(1, '#2a1440');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);
        for (const [x, y, r, color] of [
            [0.2, 0.25, 0.45, 'rgba(124,108,255,0.16)'],
            [0.85, 0.6, 0.4, 'rgba(255,110,180,0.12)'],
            [0.5, 1.05, 0.5, 'rgba(244,196,78,0.12)'],
        ]) {
            const glow = ctx.createRadialGradient(x * width, y * height, 0, x * width, y * height, r * Math.max(width, height));
            glow.addColorStop(0, color);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, width, height);
        }
        if (geo.small) return;
        for (const star of stars) {
            ctx.globalAlpha = 0.35 + 0.35 * Math.sin(now / 900 + star.phase);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(star.x * width, star.y * height, star.r, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawPegs(ctx, now) {
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col <= row; col++) {
                const { x, y } = pegAt(row, col);
                const glow = glows.get(`${row}:${col}`);
                const lit = glow ? Math.max(0, 1 - (now - glow.at) / 450) : 0;
                if (lit > 0) {
                    ctx.fillStyle = glow.color;
                    ctx.globalAlpha = lit * 0.55;
                    ctx.beginPath();
                    ctx.arc(x, y, geo.peg * (2.5 + lit * 2), 0, TAU);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
                ctx.fillStyle = lit > 0 ? '#fff' : 'rgba(225,220,255,0.75)';
                ctx.beginPath();
                ctx.arc(x, y, geo.peg * (1 + lit * 0.4), 0, TAU);
                ctx.fill();
            }
        }
    }

    function drawSlots(ctx, now, teasing, flashes) {
        const w = geo.spacing * 0.9;
        PLINKO_SLOTS.forEach((value, slot) => {
            const style = SLOT_STYLE[value];
            const x = geo.x0 + (slot - ROWS / 2) * geo.spacing - w / 2;
            const flash = flashes.find((f) => f.slot === slot);
            const pop = flash ? Math.max(0, 1 - (now - flash.at) / 500) : 0;
            const tease = value === 'jackpot' && teasing ? 0.5 + 0.5 * Math.sin(now / 90) : 0;
            const y = geo.slotY - pop * 4;
            ctx.save();
            if (value === 'jackpot' || pop) {
                ctx.shadowColor = value === 'jackpot' ? '#f4c44e' : style.fill[0];
                ctx.shadowBlur = 10 + tease * 22 + pop * 18;
            }
            const fill = ctx.createLinearGradient(x, y, x, y + geo.slotH);
            style.fill.forEach((color, i) => fill.addColorStop(i / (style.fill.length - 1), color));
            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.roundRect(x, y, w, geo.slotH, Math.min(8, geo.slotH / 3));
            ctx.fill();
            ctx.restore();
            // A light sweeping across the jackpot slots
            if (value === 'jackpot') {
                const sweep = ((now / 1400) % 1) * (w * 3) - w;
                const shine = ctx.createLinearGradient(x + sweep - w / 2, 0, x + sweep + w / 2, 0);
                shine.addColorStop(0, 'rgba(255,255,255,0)');
                shine.addColorStop(0.5, 'rgba(255,255,255,0.55)');
                shine.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(x, y, w, geo.slotH, Math.min(8, geo.slotH / 3));
                ctx.clip();
                ctx.fillStyle = shine;
                ctx.fillRect(x, y, w, geo.slotH);
                ctx.restore();
            }
            if (!geo.small || value === 'jackpot') {
                ctx.fillStyle = style.text;
                ctx.font = `700 ${Math.max(9, Math.min(14, geo.slotH * 0.48))}px Inter, system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(style.label, x + w / 2, y + geo.slotH / 2 + 1);
            }
        });
    }

    function drawBall(ctx, ball, pos, mine) {
        const color = ballColor(ball.username);
        const trail = trails.get(ball.id) ?? [];
        trail.push({ x: pos.x, y: pos.y });
        if (trail.length > 8) trail.shift();
        trails.set(ball.id, trail);
        trail.forEach((point, i) => {
            ctx.globalAlpha = (i / trail.length) * 0.35;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, geo.ball * (0.4 + (i / trail.length) * 0.5), 0, TAU);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        const orb = ctx.createRadialGradient(pos.x - geo.ball * 0.35, pos.y - geo.ball * 0.35, 0, pos.x, pos.y, geo.ball);
        orb.addColorStop(0, '#fff');
        orb.addColorStop(0.45, color);
        orb.addColorStop(1, color);
        ctx.fillStyle = orb;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, geo.ball, 0, TAU);
        ctx.fill();
        ctx.restore();
        if (mine) {
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, geo.ball + 2.5, 0, TAU);
            ctx.stroke();
        }
    }

    function drawFlashes(ctx, now, flashes) {
        for (const flash of flashes) {
            const age = (now - flash.at) / 1300;
            if (age > 1) continue;
            ctx.globalAlpha = 1 - age;
            ctx.fillStyle = flash.color;
            ctx.font = `800 ${Math.max(12, geo.spacing * 0.42)}px "Space Grotesk", Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(flash.text, geo.x0 + (flash.slot - ROWS / 2) * geo.spacing, geo.slotY - 12 - age * 34);
        }
        ctx.globalAlpha = 1;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ width: number, height: number, now: number, balls: Array<{ id: string, username: string, path: boolean[], slot: number, droppedAt: number }>, me: string, flashes: Array<{ slot: number, text: string, color: string, at: number }> }} frame
     * @returns {Array<{ type: 'peg', ball: object, mine: boolean } | { type: 'land', ball: object }>}
     */
    function draw(ctx, { width, height, now, balls, me, flashes }) {
        if (!geo || geo.width !== width || geo.height !== height) layout(width, height);
        const events = [];
        const positions = [];
        let teasing = false;
        for (const ball of balls) {
            ball.times ??= plinkoTimes(ball.path);
            const pos = ballPosition(ball, now - ball.droppedAt);
            positions.push([ball, pos]);
            if (!pos.landed && pos.row >= 7 && pos.row < ROWS && (pos.rights === 0 || pos.rights === pos.row)) teasing = true;
            // Every peg reached since the last frame lights up
            const last = seen.get(ball.id) ?? -1;
            for (let row = last + 1; row <= Math.min(pos.row, ROWS - 1); row++) {
                if (now - ball.droppedAt < ball.times[row]) break;
                let rights = 0;
                for (let r = 0; r < row; r++) rights += ball.path[r] ? 1 : 0;
                glows.set(`${row}:${rights}`, { at: now, color: ballColor(ball.username) });
                events.push({ type: 'peg', ball, mine: ball.username === me });
                seen.set(ball.id, row);
            }
            if (pos.landed && seen.get(ball.id) !== 'landed') {
                seen.set(ball.id, 'landed');
                events.push({ type: 'land', ball });
            }
        }
        drawSky(ctx, now);
        drawPegs(ctx, now);
        drawSlots(ctx, now, teasing, flashes);
        for (const [ball, pos] of positions) {
            if (!pos.landed) drawBall(ctx, ball, pos, ball.username === me);
        }
        drawFlashes(ctx, now, flashes);
        // Forget balls no longer on the board
        const live = new Set(balls.map((ball) => ball.id));
        for (const id of [...trails.keys()]) if (!live.has(id)) trails.delete(id);
        for (const id of [...seen.keys()]) if (!live.has(id)) seen.delete(id);
        return events;
    }

    return { draw };
}
