<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MuteButton from '@/components/party/MuteButton.vue';
import { playCasinoSound, unlockCasinoSound } from '@/lib/casinoSounds';
import { createPlinkoBoard, ballColor } from '@/lib/plinko/board';
import { serverNow } from '@/lib/serverClock';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { formatJackpot, PLINKO, PLINKO_SLOTS } from '../../../../api/plinko.ts';
import { formatMoney } from '../../../../api/money.ts';

const app = useAppStore();
const client = useClientStore();
const game = computed(() => client.state.plinko);
const me = computed(() => client.state.user.username);
const soundOn = computed(() => app.gameSound('plinko'));
const isGuest = computed(() => !client.state.user.id);

// Above this jackpot, a ball is worth more than it costs: 50% back in small wins, plus 1 in 2,000 of the jackpot
const WORTH_IT = (PLINKO.ballPrice / 2) * PLINKO.jackpotOdds;

const canvas = ref(null);
const board = createPlinkoBoard();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Balls stay here until they visibly land, even when the server's update drops them a moment earlier
const balls = new Map();
const landed = new Set();
const flashes = [];
watch(
    () => game.value?.balls,
    (list) => {
        for (const ball of list ?? []) {
            if (!balls.has(ball.id) && !landed.has(ball.id)) {
                balls.set(ball.id, { ...ball });
                if (ball.username === me.value && soundOn.value) playCasinoSound('drop');
            }
        }
    },
    { immediate: true },
);

// The meter counts toward the real jackpot instead of jumping
const shownJackpot = ref(game.value?.jackpot ?? 0);
const celebration = ref(null);

const now = ref(serverNow());
const cooling = computed(() => (game.value?.you.nextDropAt ?? 0) > now.value);
const canDrop = computed(() => !isGuest.value && client.state.user.money >= PLINKO.ballPrice && !cooling.value);
const dropLabel = computed(() =>
    isGuest.value
        ? 'Log in to play'
        : client.state.user.money < PLINKO.ballPrice
        ? `A ball costs ${formatMoney(PLINKO.ballPrice)}`
        : 'Drop a ball',
);
const idleSeconds = computed(() => {
    const deadline = game.value?.idleDeadline;
    return deadline ? Math.max(0, Math.ceil((deadline - now.value) / 1000)) : null;
});
const hint = computed(() =>
    (game.value?.jackpot ?? 0) >= WORTH_IT
        ? `Above ${formatJackpot(WORTH_IT)}, every ball is worth more than it costs`
        : `Each ball adds ${formatMoney(PLINKO.toJackpot)} to the jackpot · 1 in ${PLINKO.jackpotOdds.toLocaleString('en-US')} wins it all`,
);
const recent = computed(() => (game.value?.recent ?? []).slice(0, 6));

const drop = () => {
    unlockCasinoSound();
    client.sendMessage('/party drop');
};

let lastLandSound = 0;
function onLand(ball) {
    balls.delete(ball.id);
    landed.add(ball.id);
    const value = PLINKO_SLOTS[ball.slot];
    const mine = ball.username === me.value;
    if (value === 'jackpot') {
        const won = game.value?.recent.find((entry) => entry.id === ball.id)?.win ?? Math.round(shownJackpot.value);
        flashes.push({ slot: ball.slot, text: 'JACKPOT', color: '#ffe08a', at: now.value });
        celebration.value = { username: ball.username, amount: won, mine, until: now.value + 7000 };
        if (soundOn.value) playCasinoSound('jackpot');
        return;
    }
    const win = PLINKO.ballPrice * value;
    flashes.push({
        slot: ball.slot,
        text: win ? `+${formatMoney(win)}` : '0',
        color: win > PLINKO.ballPrice ? '#ffd6f0' : win ? '#bff5ff' : '#8a8aa8',
        at: now.value,
    });
    // One landing sound at a time: a tab coming back from the background lands every overdue ball in one frame
    if (!soundOn.value || now.value - lastLandSound < 120) return;
    // Your own results always sound; others only when they win big, so a busy board stays pleasant
    if (value >= 5 || mine) lastLandSound = now.value;
    if (value >= 5) playCasinoSound('blackjack');
    else if (mine) playCasinoSound(value >= 1 ? 'win' : value > 0 ? 'push' : 'thud');
}

let frame = null;
let last = 0;
function loop(time) {
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
    last = time;
    now.value = serverNow();
    const target = game.value?.jackpot ?? 0;
    shownJackpot.value += (target - shownJackpot.value) * Math.min(1, dt * 5);
    if (Math.abs(target - shownJackpot.value) < 1) shownJackpot.value = target;
    while (flashes.length && now.value - flashes[0].at > 1500) flashes.shift();
    if (celebration.value && now.value > celebration.value.until) celebration.value = null;

    const el = canvas.value;
    if (el) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const width = el.clientWidth;
        const height = el.clientHeight;
        if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) {
            el.width = Math.round(width * dpr);
            el.height = Math.round(height * dpr);
        }
        const ctx = el.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const events = board.draw(ctx, {
            width,
            height,
            now: reducedMotion ? now.value + 60_000 : now.value,
            balls: [...balls.values()],
            me: me.value,
            flashes,
        });
        let ticked = false;
        for (const event of events) {
            if (event.type === 'land') onLand(event.ball);
            // One tick a frame at most, and only for your own balls
            else if (event.mine && !ticked && soundOn.value) {
                playCasinoSound('peg');
                ticked = true;
            }
        }
    }
    frame = requestAnimationFrame(loop);
}

onMounted(() => (frame = requestAnimationFrame(loop)));
onBeforeUnmount(() => cancelAnimationFrame(frame));

// A shower of coins for the jackpot, laid out once
const coins = Array.from({ length: 28 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 7) * 0.25}s`,
    duration: `${2.2 + (i % 5) * 0.35}s`,
}));
</script>

<template>
    <div class="plinko">
        <div class="frame">
            <div class="top">
                <span class="title">Plinko</span>
                <div class="meter" role="status" aria-label="Jackpot">
                    <span class="meter-label">★ Jackpot ★</span>
                    <span class="meter-value">{{ formatJackpot(shownJackpot) }}</span>
                </div>
                <MuteButton game="plinko" />
            </div>

            <p class="hint">{{ hint }}</p>

            <div class="body">
                <canvas ref="canvas" class="board" aria-label="Plinko board"></canvas>

                <div v-if="celebration" class="celebrate" role="alert">
                    <span
                        v-for="(coin, i) in coins"
                        :key="i"
                        class="coin"
                        :style="{ left: coin.left, animationDelay: coin.delay, animationDuration: coin.duration }"
                        >🪙</span
                    >
                    <div class="celebrate-card">
                        <div class="celebrate-title">★ JACKPOT ★</div>
                        <div class="celebrate-amount">{{ formatJackpot(celebration.amount) }}</div>
                        <div class="celebrate-who">{{ celebration.mine ? 'You won it!' : `@${celebration.username} won it` }}</div>
                    </div>
                </div>
            </div>

            <div class="bottom">
                <ul class="recent" aria-label="Last drops">
                    <li v-for="entry in recent" :key="entry.id" :class="{ jackpot: entry.jackpot, won: entry.win > PLINKO.ballPrice }">
                        <span class="dot" :style="{ background: ballColor(entry.username) }"></span>
                        <span class="who">{{ entry.username }}</span>
                        <span class="amount">{{
                            entry.jackpot ? `★ ${formatJackpot(entry.win)}` : entry.win ? `+${formatMoney(entry.win)}` : '0'
                        }}</span>
                    </li>
                </ul>
                <span v-if="idleSeconds !== null && idleSeconds <= 15" class="idle">Round ends in {{ idleSeconds }}s</span>
                <button class="drop" :disabled="!canDrop" @click="drop">
                    {{ dropLabel }}
                    <span v-if="!isGuest && client.state.user.money >= PLINKO.ballPrice" class="price">{{
                        formatMoney(PLINKO.ballPrice)
                    }}</span>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.plinko {
    container-type: size;
    width: 100%;
    height: 100%;
}
.frame {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #0d0a24;
    color: #f4f4ff;
}
.top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: clamp(3px, 1.5cqh, 10px) clamp(8px, 2cqw, 20px);
}
.title {
    font-weight: 700;
    font-size: clamp(12px, 3.6cqh, 15px);
}
.meter {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.05;
    min-width: 0;
}
.meter-label {
    font-family: ui-monospace, monospace;
    font-size: clamp(9px, 2.4cqh, 11px);
    letter-spacing: 0.18em;
    color: #f4c44e;
    opacity: 0.85;
}
.meter-value {
    font-weight: 800;
    font-size: clamp(18px, 8cqh, 46px);
    font-variant-numeric: tabular-nums;
    background: linear-gradient(100deg, #fff3c4 0%, #f4c44e 35%, #fff8dc 50%, #e0a93a 65%, #fff3c4 100%);
    background-size: 220% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 0 14px rgba(244, 196, 78, 0.35));
}
.body {
    position: relative;
    flex: 1;
    min-height: 0;
}
.board {
    display: block;
    width: 100%;
    height: 100%;
}
.hint {
    margin: 0 0 2px;
    padding: 0 12px;
    text-align: center;
    font-size: 12px;
    color: rgb(255 255 255 / 0.55);
}
.bottom {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: clamp(4px, 1.5cqh, 10px) clamp(8px, 2cqw, 20px);
    background: rgb(255 255 255 / 0.03);
    border-top: 1px solid rgb(255 255 255 / 0.06);
}
.recent {
    display: flex;
    gap: 6px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    margin: 0;
    padding: 0;
    list-style: none;
}
.recent li {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.06);
    font-size: 12px;
    white-space: nowrap;
}
.recent li.won {
    background: rgb(196 90 160 / 0.25);
}
.recent li.jackpot {
    background: rgb(244 196 78 / 0.25);
    color: #ffe08a;
}
.recent .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}
.recent .who {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
}
.recent .amount {
    font-family: ui-monospace, monospace;
    color: rgb(255 255 255 / 0.75);
}
.idle {
    font-size: 12px;
    color: #ff8fa3;
    white-space: nowrap;
}
.drop {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: clamp(6px, 2cqh, 10px) 18px;
    border-radius: 10px;
    font-weight: 700;
    color: #2a1c04;
    background: linear-gradient(180deg, #ffe08a, #f4c44e 55%, #c9952a);
    box-shadow:
        0 0 18px rgb(244 196 78 / 0.35),
        inset 0 1px 0 rgb(255 255 255 / 0.6);
    white-space: nowrap;
}
.drop:disabled {
    opacity: 0.45;
    box-shadow: none;
}
.drop:not(:disabled):active {
    transform: translateY(1px);
}
.drop .price {
    padding: 1px 7px;
    border-radius: 6px;
    background: rgb(42 28 4 / 0.15);
    font-size: 12px;
}
.celebrate {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: radial-gradient(ellipse at center, rgb(244 196 78 / 0.25), rgb(13 10 36 / 0.85) 70%);
}
.celebrate-card {
    position: relative;
    text-align: center;
}
.celebrate-title {
    font-family: ui-monospace, monospace;
    letter-spacing: 0.3em;
    color: #ffe08a;
    font-size: clamp(12px, 4cqh, 18px);
}
.celebrate-amount {
    font-weight: 900;
    font-size: clamp(30px, 16cqh, 84px);
    line-height: 1;
    color: #fff3c4;
    text-shadow: 0 0 30px rgb(244 196 78 / 0.8);
}
.celebrate-who {
    margin-top: 6px;
    font-size: clamp(13px, 4cqh, 18px);
}
.coin {
    position: absolute;
    top: -40px;
    font-size: clamp(16px, 5cqh, 28px);
    animation: fall linear infinite;
}
@keyframes fall {
    to {
        transform: translateY(calc(100cqh + 80px)) rotate(540deg);
    }
}
@media (prefers-reduced-motion: no-preference) {
    .meter-value {
        animation: shimmer 4s linear infinite;
    }
    .celebrate-amount {
        animation: throb 0.9s ease-in-out infinite alternate;
    }
}
@keyframes shimmer {
    to {
        background-position: -220% 0;
    }
}
@keyframes throb {
    to {
        transform: scale(1.06);
    }
}
@media (prefers-reduced-motion: reduce) {
    .coin {
        display: none;
    }
}
/* Small player: a slim strip, the meter inline */
@container (max-height: 220px) {
    .meter {
        flex-direction: row;
        justify-content: center;
        gap: 8px;
    }
    .hint,
    .recent {
        display: none;
    }
    .bottom {
        justify-content: flex-end;
    }
}
/* Smallest player: no room for the board, the meter and the button are the game */
@container (max-height: 130px) {
    .body {
        display: none;
    }
    .frame {
        justify-content: center;
    }
}
</style>
