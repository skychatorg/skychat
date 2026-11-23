<script setup>
import { computed, ref, watch } from 'vue';
import CasinoChip from '@/components/casino/CasinoChip.vue';
import DrainBar from '@/components/party/DrainBar.vue';
import MuteButton from '@/components/party/MuteButton.vue';
import { useCountdown } from '@/composables/useCountdown';
import { playCasinoSound, unlockCasinoSound } from '@/lib/casinoSounds';
import { betChips, chipColor } from '@/lib/channel';
import { serverNow } from '@/lib/serverClock';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { formatMoney } from '../../../../api/money.ts';
import { pocketColor, ROULETTE_SPACES, WHEEL } from '../../../../api/roulette.ts';

const app = useAppStore();
const client = useClientStore();
const game = computed(() => client.state.roulette);
const me = computed(() => client.state.user.username);
const isGuest = computed(() => !client.state.user.id);
const soundOn = computed(() => app.gameSound('roulette'));

const { seconds, total } = useCountdown(() => game.value?.deadline);

// The chip a click puts down
const chips = computed(() => betChips(game.value.limits));
const chip = ref(null);
watch(
    chips,
    (list) => {
        if (!list.includes(chip.value)) chip.value = list[0];
    },
    { immediate: true },
);

const betting = computed(() => game.value.phase === 'betting');
const myBets = computed(() => game.value.bets.filter((bet) => bet.username === me.value));
const myTotal = computed(() => myBets.value.reduce((sum, bet) => sum + bet.amount, 0));
const onSpace = (space) => {
    let mine = 0;
    let others = 0;
    for (const bet of game.value.bets) {
        if (bet.space !== space) continue;
        if (bet.username === me.value) mine += bet.amount;
        else others += bet.amount;
    }
    return { mine, others };
};
const won = (space) => game.value.phase === 'results' && game.value.result !== null && ROULETTE_SPACES[space].covers(game.value.result);

const bet = (space) => {
    if (!betting.value || isGuest.value) return;
    unlockCasinoSound();
    client.sendMessage(`/party bet ${space} ${chip.value}`);
};
const clear = () => client.sendMessage('/party clear');

// The table: the zero, then three rows of twelve (3 6 9 … on top), then the dozens and the even-money bets
const rows = [3, 2, 1].map((start) => Array.from({ length: 12 }, (_, i) => start + i * 3));
const dozens = [43, 44, 45];
const evens = [41, 40, 37, 38, 39, 42];

// The wheel turns so the result stops under the marker, while the ball circles the other way
const POCKET = 360 / WHEEL.length;
const wheelTurn = ref(0);
const ballTurn = ref(0);
const spinMs = ref(0);
watch(
    () => [game.value?.phase, game.value?.result, game.value?.spinStartedAt],
    ([phase, result, startedAt]) => {
        if (result === null || startedAt === null) return;
        const left = Math.max(0, startedAt + game.value.spinMs - serverNow());
        spinMs.value = phase === 'spinning' ? left : 0;
        // Always forward: whole turns past the current angle, then the pocket under the marker
        const base = Math.ceil(wheelTurn.value / 360) * 360 + 360 * 5;
        wheelTurn.value = base - WHEEL.indexOf(result) * POCKET;
        ballTurn.value -= 360 * 3;
        if (phase === 'spinning' && left > 0 && soundOn.value) playCasinoSound('whoosh');
    },
    { immediate: true },
);

const lastResult = computed(() => (game.value.phase === 'results' ? game.value.result : null));
const myResult = computed(() => game.value.results.find((entry) => entry.username === me.value) ?? null);
watch(myResult, (result) => {
    if (!result || !soundOn.value) return;
    playCasinoSound(result.net > 0 ? 'win' : result.net < 0 ? 'lose' : 'push');
});
watch(
    () => myBets.value.length,
    (count, before) => count > before && soundOn.value && playCasinoSound('chip'),
);

const status = computed(() => {
    const g = game.value;
    if (g.phase === 'betting') return `Place your bets · ${seconds.value}s`;
    if (g.phase === 'spinning') return 'No more bets';
    return `${g.result} ${pocketColor(g.result)}`;
});
const winners = computed(() => [...game.value.results].filter((entry) => entry.won > 0).sort((a, b) => b.won - a.won));
</script>

<template>
    <div class="roulette">
        <div class="frame">
            <div class="top">
                <span class="title">Roulette</span>
                <span class="status" role="status">{{ status }}</span>
                <span class="history" aria-label="Last results">
                    <span v-for="(n, i) in game.history.slice(0, 10)" :key="i" class="pill" :class="pocketColor(n)">{{ n }}</span>
                </span>
                <MuteButton game="roulette" />
            </div>
            <DrainBar v-if="betting" class="drain" :deadline="game.deadline" :ms="total" :hurry="seconds <= 5" />

            <div class="body">
                <div class="wheel-zone">
                    <div class="wheel-box">
                        <svg
                            class="wheel"
                            viewBox="-100 -100 200 200"
                            :style="{ transform: `rotate(${wheelTurn}deg)`, transitionDuration: `${spinMs}ms` }"
                            aria-hidden="true"
                        >
                            <circle r="99" fill="#5a3a1c" />
                            <g v-for="(n, i) in WHEEL" :key="n" :transform="`rotate(${i * POCKET})`">
                                <path
                                    :d="`M0 0 L${-Math.sin((POCKET * Math.PI) / 360) * 92} ${
                                        -Math.cos((POCKET * Math.PI) / 360) * 92
                                    } A92 92 0 0 1 ${Math.sin((POCKET * Math.PI) / 360) * 92} ${
                                        -Math.cos((POCKET * Math.PI) / 360) * 92
                                    } Z`"
                                    :class="`pocket ${pocketColor(n)}`"
                                />
                                <text y="-80" class="pocket-label">{{ n }}</text>
                            </g>
                            <circle r="56" fill="#3a2412" />
                            <circle r="50" fill="url(#hub)" />
                            <defs>
                                <radialGradient id="hub">
                                    <stop offset="0" stop-color="#e8c873" />
                                    <stop offset="1" stop-color="#8a6420" />
                                </radialGradient>
                            </defs>
                        </svg>
                        <div
                            class="ball-track"
                            :style="{ transform: `rotate(${ballTurn}deg)`, transitionDuration: `${spinMs}ms` }"
                            aria-hidden="true"
                        >
                            <span class="ball"></span>
                        </div>
                        <span class="marker" aria-hidden="true"></span>
                        <span v-if="lastResult !== null" class="result-badge" :class="pocketColor(lastResult)">{{ lastResult }}</span>
                    </div>
                    <ul v-if="game.phase === 'results'" class="winners" aria-label="Winners">
                        <li v-if="!winners.length" class="nobody">The house takes it</li>
                        <li v-for="entry in winners.slice(0, 4)" :key="entry.username">
                            @{{ entry.username }} <b>+{{ formatMoney(entry.won) }}</b>
                        </li>
                    </ul>
                </div>

                <div class="table-zone">
                    <div class="table" :class="{ closed: !betting }">
                        <button class="cell zero" :class="{ won: won(0) }" :disabled="!betting || isGuest" @click="bet(0)">
                            0
                            <span v-if="onSpace(0).mine" class="stack"
                                ><CasinoChip :value="onSpace(0).mine" :color="chipColor(onSpace(0).mine)"
                            /></span>
                        </button>
                        <template v-for="(row, r) in rows" :key="r">
                            <button
                                v-for="n in row"
                                :key="n"
                                class="cell"
                                :class="[pocketColor(n), { won: won(n) }]"
                                :style="{ gridRow: r + 1 }"
                                :disabled="!betting || isGuest"
                                @click="bet(n)"
                            >
                                {{ n }}
                                <span v-if="onSpace(n).mine" class="stack"
                                    ><CasinoChip :value="onSpace(n).mine" :color="chipColor(onSpace(n).mine)"
                                /></span>
                                <span
                                    v-else-if="onSpace(n).others"
                                    class="others"
                                    :title="`${formatMoney(onSpace(n).others)} from others`"
                                ></span>
                            </button>
                        </template>
                        <button
                            v-for="(space, i) in dozens"
                            :key="space"
                            class="cell outside dozen"
                            :class="{ won: won(space) }"
                            :style="{ gridColumn: `${2 + i * 4} / span 4` }"
                            :disabled="!betting || isGuest"
                            @click="bet(space)"
                        >
                            {{ ROULETTE_SPACES[space].label }}
                            <span v-if="onSpace(space).mine" class="stack"
                                ><CasinoChip :value="onSpace(space).mine" :color="chipColor(onSpace(space).mine)"
                            /></span>
                        </button>
                        <button
                            v-for="(space, i) in evens"
                            :key="space"
                            class="cell outside"
                            :class="[{ won: won(space) }, space === 37 ? 'red' : space === 38 ? 'black' : '']"
                            :style="{ gridColumn: `${2 + i * 2} / span 2` }"
                            :disabled="!betting || isGuest"
                            @click="bet(space)"
                        >
                            {{ ROULETTE_SPACES[space].label }}
                            <span v-if="onSpace(space).mine" class="stack"
                                ><CasinoChip :value="onSpace(space).mine" :color="chipColor(onSpace(space).mine)"
                            /></span>
                        </button>
                    </div>

                    <div class="controls">
                        <template v-if="!isGuest">
                            <div class="chips" role="group" aria-label="Chip">
                                <button
                                    v-for="value in chips"
                                    :key="value"
                                    class="chip"
                                    :class="{ chosen: chip === value }"
                                    :aria-pressed="chip === value"
                                    :title="`Bet ${formatMoney(value)} a click`"
                                    @click="chip = value"
                                >
                                    <CasinoChip :value="value" :color="chipColor(value)" />
                                </button>
                            </div>
                            <span class="mine">
                                <template v-if="myResult">
                                    {{
                                        myResult.net > 0
                                            ? `You won ${formatMoney(myResult.net)}`
                                            : myResult.net < 0
                                            ? `You lost ${formatMoney(-myResult.net)}`
                                            : 'Broke even'
                                    }}
                                </template>
                                <template v-else-if="myTotal">On the table: {{ formatMoney(myTotal) }}</template>
                                <template v-else-if="betting">Pick a chip, then click the table</template>
                            </span>
                            <button v-if="betting && myTotal" class="clear" @click="clear">Take back</button>
                        </template>
                        <span v-else class="mine">Log in to play</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.roulette {
    container-type: size;
    width: 100%;
    height: 100%;
}
.frame {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: radial-gradient(ellipse at 30% 40%, #1d5a3c, #0d2a1c 75%);
    color: #f4f4ff;
}
.top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: clamp(3px, 1.5cqh, 10px) clamp(8px, 2cqw, 20px);
    font-size: clamp(12px, 3.6cqh, 15px);
    min-width: 0;
}
.title {
    font-weight: 700;
}
.status {
    font-family: ui-monospace, monospace;
    color: rgb(255 255 255 / 0.8);
    white-space: nowrap;
}
.history {
    display: flex;
    gap: 4px;
    margin-left: auto;
    overflow: hidden;
    min-width: 0;
}
.pill {
    min-width: 22px;
    padding: 1px 4px;
    border-radius: 6px;
    text-align: center;
    font:
        600 11px ui-monospace,
        monospace;
}
.pill.red,
.result-badge.red,
.cell.red {
    background: #b3261e;
}
.pill.black,
.result-badge.black,
.cell.black {
    background: #1b1b1f;
}
.pill.green,
.result-badge.green,
.cell.zero {
    background: #1f7a45;
}
.drain {
    height: 3px;
    margin: 0 clamp(8px, 2cqw, 20px);
}
.body {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: clamp(8px, 2cqw, 24px);
    padding: clamp(6px, 2cqh, 16px) clamp(8px, 2cqw, 20px);
}
.wheel-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex: 0 0 auto;
}
.wheel-box {
    position: relative;
    height: min(100cqh - 90px, 42cqw, 320px);
    aspect-ratio: 1;
}
.wheel,
.ball-track {
    position: absolute;
    inset: 0;
    transition-property: transform;
    transition-timing-function: cubic-bezier(0.15, 0.6, 0.25, 1);
}
.wheel {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 8px 18px rgb(0 0 0 / 0.5));
}
.pocket.red {
    fill: #b3261e;
}
.pocket.black {
    fill: #1b1b1f;
}
.pocket.green {
    fill: #1f7a45;
}
.pocket {
    stroke: #c9a24a;
    stroke-width: 0.6;
}
.pocket-label {
    fill: #fff;
    font:
        700 7px ui-monospace,
        monospace;
    text-anchor: middle;
    dominant-baseline: middle;
}
.ball-track {
    pointer-events: none;
}
.ball {
    position: absolute;
    left: 50%;
    top: 14%;
    width: 6%;
    aspect-ratio: 1;
    border-radius: 50%;
    transform: translateX(-50%);
    background: radial-gradient(circle at 35% 35%, #fff, #c9c9d4);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
}
.marker {
    position: absolute;
    left: 50%;
    top: -4px;
    transform: translateX(-50%);
    border: 7px solid transparent;
    border-top: 11px solid #f4c44e;
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.6));
}
.result-badge {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 30%;
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-weight: 800;
    font-size: clamp(16px, 7cqh, 34px);
    border: 3px solid #f4c44e;
    box-shadow: 0 0 24px rgb(244 196 78 / 0.6);
}
.winners {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 12px;
    text-align: center;
}
.winners b {
    color: #7ef0a8;
}
.winners .nobody {
    color: rgb(255 255 255 / 0.6);
}
.table-zone {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
}
.table {
    display: grid;
    grid-template-columns: 1.2fr repeat(12, 1fr);
    /* The numbers get the height, the outside bets a bit less: together they stand as tall as the wheel */
    grid-template-rows: repeat(3, minmax(26px, 1fr)) repeat(2, minmax(24px, 0.75fr));
    gap: clamp(3px, 0.8cqh, 6px);
    height: min(100cqh - 150px, 330px);
}
.table.closed .cell:not(.won) {
    opacity: 0.75;
}
.cell {
    position: relative;
    display: grid;
    place-items: center;
    border-radius: 5px;
    font:
        700 clamp(10px, 3.6cqh, 18px) ui-monospace,
        monospace;
    color: #fff;
    border: 1px solid rgb(255 255 255 / 0.18);
    min-width: 0;
}
.cell.zero {
    grid-row: 1 / span 3;
    grid-column: 1;
}
.cell.outside {
    background: rgb(255 255 255 / 0.06);
    font-size: clamp(10px, 3cqh, 15px);
}
.cell.outside.red {
    background: #b3261e;
}
.cell.outside.black {
    background: #1b1b1f;
}
.cell.dozen {
    grid-row: 4;
}
.cell.outside:not(.dozen) {
    grid-row: 5;
}
.cell:not(:disabled):hover {
    outline: 2px solid #f4c44e;
    z-index: 1;
}
.cell.won {
    outline: 2px solid #f4c44e;
    box-shadow: 0 0 16px rgb(244 196 78 / 0.8);
    z-index: 1;
}
.stack {
    position: absolute;
    width: clamp(16px, 6cqh, 28px);
    right: -6px;
    bottom: -6px;
    pointer-events: none;
    z-index: 2;
}
.others {
    position: absolute;
    right: 3px;
    top: 3px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f4c44e;
}
.controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}
.chips {
    display: flex;
    gap: 6px;
}
.chip {
    width: clamp(30px, 10cqh, 50px);
    border-radius: 50%;
    transition: transform 0.15s;
}
.chip.chosen {
    transform: translateY(-4px);
    box-shadow: 0 0 0 2px #f4c44e;
}
.mine {
    font-size: clamp(12px, 3cqh, 15px);
    color: rgb(255 255 255 / 0.8);
}
.clear {
    margin-left: auto;
    padding: 5px 12px;
    border-radius: 8px;
    font-size: 13px;
    background: rgb(255 255 255 / 0.1);
}
.clear:hover {
    background: rgb(255 255 255 / 0.18);
}
@media (prefers-reduced-motion: reduce) {
    .wheel,
    .ball-track {
        transition-duration: 0ms !important;
    }
}
/* Narrow: the wheel goes above the table */
@container (max-width: 640px) {
    .body {
        flex-direction: column;
    }
    .wheel-box {
        height: min(30cqh, 160px);
    }
    .table {
        height: auto;
    }
}
/* Short: no room for the wheel, the result badge takes its place in the status line */
@container (max-height: 300px) {
    .wheel-zone {
        display: none;
    }
    .body {
        padding-top: 2px;
        padding-bottom: 6px;
    }
    /* The table shrinks to the height left instead of pushing the controls out */
    .table-zone {
        justify-content: stretch;
        gap: 6px;
    }
    .table {
        height: auto;
        flex: 1;
        min-height: 0;
        grid-template-rows: repeat(5, minmax(0, 1fr));
        gap: 2px;
    }
    .cell {
        font-size: clamp(9px, 5cqh, 13px);
    }
    .chip {
        width: clamp(24px, 12cqh, 34px);
    }
}
/* Smallest player: just the even-money bets and the chips */
@container (max-height: 160px) {
    .history,
    .drain {
        display: none;
    }
    /* One row: the six even-money bets, then the chips */
    .table-zone {
        flex-direction: row;
        align-items: center;
    }
    .table {
        grid-template-columns: repeat(6, minmax(0, 1fr));
        grid-template-rows: minmax(0, 1fr);
        height: 100%;
    }
    .cell:not(.outside),
    .cell.dozen {
        display: none;
    }
    /* !important: the full table places these cells with inline columns */
    .cell.outside:not(.dozen) {
        grid-row: 1;
        grid-column: auto !important;
    }
    .body {
        padding-top: 0;
    }
    .controls {
        flex-wrap: nowrap;
    }
    .controls .mine {
        display: none;
    }
}
</style>
