<script setup>
import { playCasinoSound } from '@/lib/casinoSounds';
import { useCountdown } from '@/composables/useCountdown';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { formatMoney } from '../../../../api/money.ts';
import { computed, onUnmounted, ref, watch } from 'vue';

const app = useAppStore();
const client = useClientStore();

const game = computed(() => client.state.crash);
const me = computed(() => client.state.user);
const myBet = computed(() => game.value.bets.find((b) => b.user.id === me.value.id) ?? null);
const { seconds: betSeconds } = useCountdown(() => game.value.deadline);

// The flight is drawn on the server's clock: the offset is taken from each update
let offset = 0;
watch(
    () => game.value.now,
    (now) => (offset = now - Date.now()),
    { immediate: true },
);

// Redrawn every frame while flying, like the server computes it
const elapsed = ref(0);
let frame = null;
const tick = () => {
    elapsed.value = Date.now() + offset - game.value.startedAt;
    frame = requestAnimationFrame(tick);
};
watch(
    () => game.value.phase,
    (phase) => {
        cancelAnimationFrame(frame);
        if (phase === 'flying') {
            tick();
        }
    },
    { immediate: true },
);
onUnmounted(() => cancelAnimationFrame(frame));

const multiplier = computed(() => {
    if (game.value.phase === 'crashed') {
        return game.value.crashedAt;
    }
    if (game.value.phase === 'betting') {
        return 100;
    }
    return Math.floor(100 * 2 ** (Math.max(0, elapsed.value) / game.value.doubleMs));
});
const times = (hundredths) => `×${(hundredths / 100).toFixed(2)}`;

// The curve: time across, multiplier up, both axes growing with the flight
const curve = computed(() => {
    const t = game.value.phase === 'crashed' ? Math.log2(game.value.crashedAt / 100) * game.value.doubleMs : Math.max(0, elapsed.value);
    const spanT = Math.max(t, game.value.doubleMs * 1.5);
    const spanM = Math.max(multiplier.value / 100, 2) - 1;
    const points = Array.from({ length: 41 }, (_, i) => {
        const at = (t * i) / 40;
        const m = 2 ** (at / game.value.doubleMs) - 1;
        return [(at / spanT) * 100, 100 - (m / spanM) * 92];
    });
    return { path: 'M' + points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L'), tip: points.at(-1) };
});

const status = computed(() => {
    switch (game.value.phase) {
        case 'betting':
            return `Bets close in ${betSeconds.value}s`;
        case 'flying':
            return 'In flight';
        default:
            return `Crashed at ${times(game.value.crashedAt)}`;
    }
});

// Chips between the table limits, like the blackjack table
const choices = computed(() => {
    const { minBet, maxBet } = game.value;
    return [...new Set([minBet, minBet * 2, minBet * 5, maxBet].map((bet) => Math.min(bet, maxBet)))].sort((a, b) => a - b);
});
const canBet = computed(() => me.value.id && game.value.phase === 'betting' && !myBet.value);
const bet = (amount) => client.sendMessage(`/party bet ${amount}`);
const cashOut = () => client.sendMessage('/party cashout');
const cashable = computed(() => game.value.phase === 'flying' && myBet.value && myBet.value.cashedAt === null);

const hint = computed(() => {
    if (!me.value.id) {
        return 'Log in to play';
    }
    const mine = myBet.value;
    if (!mine) {
        return game.value.phase === 'betting' ? null : 'Bet on the next flight';
    }
    if (mine.cashedAt) {
        return `Cashed out at ${times(mine.cashedAt)}: +${formatMoney(mine.payout)}`;
    }
    if (game.value.phase === 'crashed') {
        return `Lost ${formatMoney(mine.bet)}`;
    }
    return `Your bet ${formatMoney(mine.bet)}`;
});

const tone = (hundredths) => (hundredths >= 1000 ? 'gold' : hundredths >= 200 ? 'good' : 'bad');

// How your own flight ended
watch(
    () => [game.value.phase, myBet.value?.cashedAt],
    ([phase, cashedAt], [beforePhase, beforeCashed]) => {
        if (!app.casinoSound || !myBet.value) {
            return;
        }
        if (cashedAt && !beforeCashed) {
            playCasinoSound('win');
        } else if (phase === 'crashed' && beforePhase === 'flying' && !cashedAt) {
            playCasinoSound('lose');
        }
    },
);
</script>

<template>
    <div class="crash">
        <div class="frame">
            <div class="top">
                <span class="title">Crash</span>
                <span class="status">{{ status }}</span>
                <span class="history" aria-label="Last crashes">
                    <span v-for="(point, i) in game.history.slice(0, 8)" :key="i" class="pill" :class="tone(point)">{{
                        times(point)
                    }}</span>
                </span>
                <button
                    class="mute"
                    :title="app.casinoSound ? 'Mute the game' : 'Turn game sounds on'"
                    :aria-pressed="!app.casinoSound"
                    @click="app.toggleCasinoSound()"
                >
                    <fa :icon="app.casinoSound ? 'volume-high' : 'volume-xmark'" />
                </button>
            </div>

            <div class="body">
                <div class="sky" :class="game.phase">
                    <svg v-if="game.phase !== 'betting'" class="graph" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <path :d="curve.path" class="line" vector-effect="non-scaling-stroke" />
                    </svg>
                    <span
                        v-if="game.phase !== 'betting'"
                        class="tip"
                        :style="{ left: `${4 + curve.tip[0] * 0.9}%`, top: `${8 + curve.tip[1] * 0.86}%` }"
                        aria-hidden="true"
                    ></span>
                    <span class="multiplier" :class="game.phase" role="status">
                        {{ game.phase === 'betting' ? betSeconds + 's' : times(multiplier) }}
                    </span>
                </div>

                <div class="side">
                    <div class="controls">
                        <button v-if="cashable" class="cashout" @click="cashOut">
                            <!-- Always two decimals with tabular digits, so the label keeps its width while it climbs -->
                            Cash out ${{ (Math.floor((myBet.bet * multiplier) / 100) / 100).toFixed(2) }}
                        </button>
                        <template v-else-if="canBet">
                            <div class="chips" role="group" aria-label="Bet">
                                <button
                                    v-for="choice in choices"
                                    :key="choice"
                                    class="chip"
                                    :disabled="me.money < choice"
                                    @click="bet(choice)"
                                >
                                    {{ formatMoney(choice) }}
                                </button>
                            </div>
                        </template>
                        <p v-if="hint" class="hint">{{ hint }}</p>
                    </div>
                    <ol class="bets" aria-label="Bets on this flight">
                        <li v-for="entry in game.bets" :key="entry.user.id" :class="{ mine: entry.user.id === me.id }">
                            <span class="who">{{ entry.user.username }}</span>
                            <span class="amount">{{ formatMoney(entry.bet) }}</span>
                            <span v-if="entry.cashedAt" class="good">{{ times(entry.cashedAt) }} +{{ formatMoney(entry.payout) }}</span>
                            <span v-else-if="game.phase === 'crashed'" class="bad">lost</span>
                            <span v-else class="muted">riding</span>
                        </li>
                        <li v-if="!game.bets.length" class="muted">No bets yet</li>
                    </ol>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.crash {
    container-type: size;
    width: 100%;
    height: 100%;
}
/* Inside the container, so the size rules below can restyle it */
.frame {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: radial-gradient(ellipse at 20% 100%, #2a1838, #121219 70%);
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
    color: rgb(255 255 255 / 0.7);
    white-space: nowrap;
}
.history {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 4px;
    justify-content: flex-end;
    overflow: hidden;
}
.pill {
    flex-shrink: 0;
    padding: 1px 6px;
    border-radius: 99px;
    font:
        600 12px ui-monospace,
        monospace;
    background: rgb(255 255 255 / 0.08);
}
.good {
    color: #7bd88f;
}
.bad {
    color: #ff8fa3;
}
.gold {
    color: #ffd54a;
}
.muted {
    color: rgb(255 255 255 / 0.55);
}
.mute {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 8px;
    color: rgb(255 255 255 / 0.7);
}
.mute:hover {
    background: rgb(255 255 255 / 0.1);
}
.body {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: clamp(6px, 2cqw, 16px);
    padding: 0 clamp(8px, 2cqw, 20px) clamp(6px, 2cqh, 16px);
}
.sky {
    position: relative;
    flex: 1;
    min-width: 0;
    border-radius: 12px;
    background:
        linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px) 0 0 / 100% 25%,
        rgb(0 0 0 / 0.25);
    overflow: hidden;
}
.graph {
    /* The tip is placed in the same box: keep its maths in step */
    position: absolute;
    inset: 8% 6% 6% 4%;
    width: 90%;
    height: 86%;
    overflow: visible;
}
.line {
    fill: none;
    stroke: #f0a63a;
    stroke-width: 3;
    stroke-linecap: round;
}
.sky.crashed .line {
    stroke: #ff8fa3;
}
.tip {
    position: absolute;
    width: 12px;
    height: 12px;
    margin: -6px 0 0 -6px;
    border-radius: 50%;
    background: #ffd54a;
    box-shadow: 0 0 14px #ffd54a;
}
.multiplier {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font:
        800 clamp(22px, 16cqh, 96px) ui-monospace,
        monospace;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 12px rgb(0 0 0 / 0.6);
}
.multiplier.betting {
    color: rgb(255 255 255 / 0.5);
}
.multiplier.crashed {
    color: #ff8fa3;
}
.side {
    width: clamp(180px, 34cqw, 300px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
}
.controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.chips {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
}
.chip,
.cashout {
    min-height: 40px;
    border-radius: 10px;
    font-weight: 700;
}
.chip {
    background: rgb(255 255 255 / 0.08);
    border: 1px solid rgb(255 255 255 / 0.18);
}
.chip:hover:not(:disabled) {
    background: rgb(255 255 255 / 0.16);
}
.chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.cashout {
    min-height: 52px;
    font-size: 17px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: #111;
    background: #7bd88f;
    box-shadow: 0 0 18px rgb(123 216 143 / 0.45);
}
.cashout:hover {
    background: #96e6a6;
}
.hint {
    margin: 0;
    font-size: 13px;
    color: rgb(255 255 255 / 0.75);
}
.bets {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
    font-size: 13px;
}
.bets li {
    display: flex;
    gap: 6px;
    padding: 3px 0;
    border-top: 1px solid rgb(255 255 255 / 0.06);
}
.bets li.mine .who {
    font-weight: 700;
}
.who {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.amount {
    font-family: ui-monospace, monospace;
    color: rgb(255 255 255 / 0.7);
}

/* Short players: the multiplier and your one action side by side, no list */
@container (max-height: 220px) {
    .history,
    .bets,
    .mute {
        display: none;
    }
    .side {
        justify-content: center;
    }
    .chips {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .chip,
    .cashout {
        min-height: 32px;
        font-size: 13px;
    }
    .hint {
        font-size: 12px;
    }
}
@container (max-height: 120px) {
    .frame {
        flex-direction: row;
    }
    .top {
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 0;
        width: 100px;
        flex-shrink: 0;
    }
    .body {
        padding: 4px 8px 4px 0;
    }
}
/* Narrow: the controls go under the flight */
@container (max-width: 520px) and (min-height: 221px) {
    .body {
        flex-direction: column;
    }
    .side {
        width: auto;
        flex: 0 0 auto;
        max-height: 50%;
    }
    .chips {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .history {
        display: none;
    }
}
</style>
