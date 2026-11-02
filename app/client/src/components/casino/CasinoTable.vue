<script setup>
import CasinoHand from '@/components/casino/CasinoHand.vue';
import { useCasinoSounds } from '@/composables/useCasinoSounds';
import { useNow } from '@/composables/useNow';
import { betLimits } from '@/lib/channel';
import { formatMoney } from '../../../../api/money.ts';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed, onMounted, provide, ref, watch } from 'vue';

// Cards land one after the other, about a second for a full table
const DEAL_STAGGER_MS = 110;
const CHIP_COLORS = ['#c9452f', '#2f6db0', '#2e8655', '#26222a'];
const OUTCOME_LABELS = { blackjack: 'Blackjack', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust' };
const BANNERS = { blackjack: 'Blackjack!', win: 'You win', push: 'Push', lose: 'Dealer wins', bust: 'Bust' };

const app = useAppStore();
const client = useClientStore();
const now = useNow();

const table = computed(() => client.state.casino);
const me = computed(() => client.state.user);
const mySeat = computed(() => table.value.seats.find((seat) => seat.user.id === me.value.id) ?? null);
const otherSeats = computed(() => table.value.seats.filter((seat) => seat !== mySeat.value));
const phase = computed(() => table.value.phase);

const secondsLeft = computed(() => (table.value.deadline ? Math.max(0, Math.ceil((table.value.deadline - now.value) / 1000)) : null));
const myTurn = computed(() => phase.value === 'playing' && mySeat.value && !mySeat.value.done);
// Chips stay on screen during the results, just disabled, so the buttons don't jump around
const showChips = computed(
    () => !me.value.id || ['waiting', 'results'].includes(phase.value) || (phase.value === 'betting' && !mySeat.value),
);
const canDouble = computed(() => myTurn.value && mySeat.value.cards.length === 2 && me.value.money >= mySeat.value.bet);

// A few chips between the table limits, like 10 · 20 · 50 · 100
const betChoices = computed(() => {
    const { minBet, maxBet } = table.value;
    return [...new Set([minBet, minBet * 2, minBet * 5, maxBet].map((bet) => Math.min(bet, maxBet)))].sort((a, b) => a - b);
});

const status = computed(() => {
    switch (phase.value) {
        case 'waiting':
            return table.value.seats.length ? 'Bet to deal the next hand' : 'Place a bet to deal a hand';
        case 'betting':
            return `Bets close in ${secondsLeft.value}s`;
        case 'playing':
            if (myTurn.value) {
                return `Your move · ${secondsLeft.value}s`;
            }
            return `${mySeat.value ? 'Waiting for the others' : 'Players are deciding'} · ${secondsLeft.value}s`;
        case 'results':
            return `Next hand in ${secondsLeft.value}s`;
        default:
            return 'Dealer draws';
    }
});

// The clock bar drains with a CSS animation, set once per deadline so it runs smooth between server updates
const clockMs = ref(0);
watch(
    () => table.value.deadline,
    (deadline) => (clockMs.value = deadline ? Math.max(0, deadline - Date.now()) : 0),
    { immediate: true },
);

const dealer = computed(() => {
    const { cards, total } = table.value.dealer;
    const bust = total > 21;
    return { result: !cards.length ? '' : bust ? `${total} · bust` : String(total), outcome: bust ? 'bust' : null };
});

function seatProps(seat) {
    if (!seat.cards.length) {
        return { result: 'In', tone: 'muted' };
    }
    if (seat.outcome) {
        const net = seat.payout - seat.bet;
        const money = net > 0 ? `+${formatMoney(net)}` : formatMoney(net);
        return {
            result: `${OUTCOME_LABELS[seat.outcome]} ${money}`,
            tone: net > 0 ? 'good' : net < 0 ? 'bad' : 'muted',
            outcome: seat.outcome,
            net,
        };
    }
    if (seat.total > 21) {
        return { result: `${seat.total} · bust`, tone: 'bad' };
    }
    return { result: seat.done ? `${seat.total} · stand` : String(seat.total), tone: '' };
}

// Cards are dealt round the table like a real dealer: first card to everyone, then the second one. Hits land right away
const seatsOnScreen = computed(() => [mySeat.value, ...otherSeats.value].filter(Boolean));
const cardDelay = (slot) => (index) => (index < 2 ? (index * (seatsOnScreen.value.length + 1) + slot) * DEAL_STAGGER_MS : 0);

// What is already on the table when it mounts (joining, cinema mode, a reload) shows still: only what happens next moves
const mounting = ref(true);
provide('casinoMounting', mounting);
onMounted(() => (mounting.value = false));

const celebratedHand = ref(null);
watch(
    () => mySeat.value?.outcome,
    (outcome) => outcome && (celebratedHand.value = table.value.handId),
);
const banner = computed(() => {
    const outcome = phase.value === 'results' && celebratedHand.value === table.value.handId && mySeat.value?.outcome;
    return outcome ? { outcome, text: BANNERS[outcome] } : null;
});

useCasinoSounds({
    table,
    myId: computed(() => me.value.id),
    myTurn,
    secondsLeft,
    enabled: computed(() => app.casinoSound),
    dealStaggerMs: DEAL_STAGGER_MS,
});

const play = (action) => client.sendMessage(`/casino ${action}`);
</script>

<template>
    <div class="casino">
        <div class="felt">
            <div class="top">
                <span class="title">Blackjack</span>
                <!-- Not a live region: the countdown would be read out every second -->
                <span class="status">{{ status }}</span>
                <span class="side">
                    <span class="limits">{{ betLimits(table) }}</span>
                    <button
                        class="mute"
                        :title="app.casinoSound ? 'Mute the table' : 'Turn table sounds on'"
                        :aria-pressed="!app.casinoSound"
                        @click="app.toggleCasinoSound()"
                    >
                        <fa :icon="app.casinoSound ? 'volume-high' : 'volume-xmark'" />
                    </button>
                </span>
                <span
                    v-if="clockMs"
                    :key="table.deadline"
                    class="clock"
                    :style="{ '--clock-ms': `${clockMs}ms` }"
                    aria-hidden="true"
                ></span>
            </div>

            <CasinoHand
                class="dealer"
                name="Dealer"
                color="#f0c46c"
                :cards="table.dealer.cards"
                :card-delay="cardDelay(seatsOnScreen.length)"
                v-bind="dealer"
            />

            <p class="printed" aria-hidden="true">♠ Blackjack pays 3 to 2 · Dealer stands on 17 ♥</p>

            <div class="seats">
                <CasinoHand
                    v-for="(seat, slot) in seatsOnScreen"
                    :key="seat.user.id"
                    class="seat"
                    :class="{ other: seat !== mySeat }"
                    :mine="seat === mySeat"
                    :active="seat === mySeat && myTurn"
                    :name="seat.user.username"
                    :color="seat.user.data.plugins.custom.color"
                    :user="seat.user"
                    :cards="seat.cards"
                    :card-delay="cardDelay(slot)"
                    :money="seat.user.money"
                    :bet="seat.bet"
                    v-bind="seatProps(seat)"
                />
                <span
                    v-if="otherSeats.length"
                    class="others"
                    :title="otherSeats.map((seat) => seat.user.username).join(', ')"
                    :aria-label="`${otherSeats.length} more at the table`"
                >
                    <fa icon="users" /> +{{ otherSeats.length }}
                </span>
                <!-- An empty seat, the same size as a hand, so the table doesn't jump when the first bet lands -->
                <CasinoHand
                    v-if="!table.seats.length"
                    class="open-seat"
                    name="Open seat"
                    :result="`up to ${table.maxSeats} players`"
                    tone="muted"
                />
            </div>

            <div class="actions">
                <template v-if="myTurn">
                    <button class="action" title="Hit" @click="play('hit')"><fa icon="plus" /><span class="label">Hit</span></button>
                    <button class="action" title="Stand" @click="play('stand')"><fa icon="hand" /><span class="label">Stand</span></button>
                    <button class="action" title="Double" :disabled="!canDouble" @click="play('double')">
                        <fa icon="angles-up" /><span class="label">Double</span>
                    </button>
                </template>
                <template v-else-if="showChips">
                    <span v-if="!me.id" class="hint">Log in to play</span>
                    <template v-else>
                        <button
                            v-for="(bet, index) in betChoices"
                            :key="bet"
                            class="chip"
                            :style="{ '--chip-color': CHIP_COLORS[index % CHIP_COLORS.length] }"
                            :disabled="phase === 'results' || me.money < bet"
                            :title="`Bet ${formatMoney(bet)}`"
                            @click="play(`bet ${bet}`)"
                        >
                            {{ formatMoney(bet) }}
                        </button>
                    </template>
                </template>
                <span v-else-if="mySeat && phase === 'betting'" class="hint">You’re in for {{ formatMoney(mySeat.bet) }}</span>
                <span v-else-if="mySeat && phase === 'playing'" class="hint">Waiting for the others</span>
                <span v-else-if="mySeat && phase === 'dealer'" class="hint">Good luck</span>
                <span v-else class="hint">Watching</span>
            </div>

            <div v-if="banner" :key="table.handId" class="banner" :class="banner.outcome" aria-hidden="true">{{ banner.text }}</div>
        </div>
    </div>
</template>

<style scoped>
/* The table sizes itself from its own box (container queries), so it fits every player size, cinema mode and phones */
.casino {
    --gold: #f0c46c;
    --cream: #f6ecd8;
    container-type: size;
    width: 100%;
    height: 100%;
    /* The wooden rail around the felt */
    padding: clamp(3px, 1.4cqh, 14px);
    background: linear-gradient(180deg, #7a4d2a, #4a2c17 55%, #2f1b0e);
}
.felt {
    --card-h: clamp(30px, 15cqh, 150px);
    --chip: clamp(34px, 8.5cqh, 64px);
    --hand-w: calc(var(--card-h) * 1.9 + 64px);
    position: relative;
    isolation: isolate;
    height: 100%;
    display: grid;
    /* Rows keep their size and the free height goes around them, so a big player has no hole above the buttons */
    grid-template-rows: auto auto auto minmax(0, auto) auto;
    align-content: space-evenly;
    gap: clamp(4px, 1.6cqh, 14px);
    padding: clamp(6px, 2.5cqh, 24px) clamp(8px, 2.5cqw, 32px);
    border-radius: clamp(6px, 5cqh, 48px);
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
        radial-gradient(ellipse at 50% 30%, #24704f, #134531 60%, #0b2c1f);
    box-shadow:
        inset 0 0 0 1px rgba(255, 220, 160, 0.18),
        inset 0 0 clamp(20px, 12cqh, 120px) rgba(0, 0, 0, 0.55);
    color: var(--cream);
    overflow: hidden;
}
/* A warm lamp hanging over the table, breathing slowly */
.felt::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background: radial-gradient(ellipse 65% 55% at 50% -8%, rgba(255, 196, 120, 0.3), transparent 70%);
}
.top {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
    padding-bottom: 5px;
}
.title {
    font:
        italic 700 clamp(14px, 3cqh, 24px) Georgia,
        serif;
    color: var(--gold);
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
}
.status {
    font:
        600 clamp(11px, 2cqh, 16px) ui-monospace,
        monospace;
    letter-spacing: 0.5px;
    color: var(--cream);
    text-align: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.side {
    display: flex;
    align-items: center;
    gap: 8px;
}
.limits {
    font:
        600 11px ui-monospace,
        monospace;
    color: rgba(246, 236, 216, 0.6);
}
.mute {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    color: rgba(246, 236, 216, 0.75);
    background: rgba(0, 0, 0, 0.2);
}
.mute:hover {
    color: var(--gold);
}
/* Time left in the phase, draining and warming up to red */
.clock {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    border-radius: 2px;
    background: var(--gold);
    transform-origin: left;
    pointer-events: none;
    animation: drain var(--clock-ms) linear forwards;
}
@keyframes drain {
    70% {
        background: var(--gold);
    }
    to {
        transform: scaleX(0);
        background: #e0623f;
    }
}
.dealer {
    justify-self: center;
}
/* The dealer has no balance or bet */
.dealer :deep(.purse) {
    display: none;
}
.printed {
    position: relative;
    justify-self: center;
    font:
        italic 600 clamp(10px, 1.7cqh, 14px) Georgia,
        serif;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(240, 196, 108, 0.42);
    white-space: nowrap;
}
.seats {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-content: flex-start;
    gap: clamp(4px, 1.5cqw, 14px);
    min-height: 0;
    overflow-y: auto;
    /* Still scrolls with many seats, but flying cards and coins poke out for a moment and must not flash a scrollbar */
    scrollbar-width: none;
}
.seats::-webkit-scrollbar {
    display: none;
}
/* Stands in for the other seats when the player is too small to show their cards */
.others {
    display: none;
    align-self: center;
    font-size: 12px;
    white-space: nowrap;
    color: rgba(246, 236, 216, 0.6);
}
.open-seat {
    border: 1px dashed rgba(240, 196, 108, 0.35);
    color: rgba(246, 236, 216, 0.6);
}
.actions {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    gap: clamp(6px, 1.5cqw, 14px);
    justify-content: center;
    align-items: center;
    /* As tall as the chips whatever it holds (chips, buttons or a hint), so the table never jumps between phases */
    min-height: var(--chip);
}
button {
    font-family: inherit;
    cursor: pointer;
    transition:
        transform 0.15s,
        filter 0.15s,
        opacity 0.2s;
}
button:disabled {
    opacity: 0.35;
    cursor: default;
}
button:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
}
button:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: brightness(1.08);
}
button:active:not(:disabled) {
    transform: translateY(1px);
}
/* Brass buttons */
.action {
    font-weight: 700;
    font-size: clamp(13px, 2.4cqh, 20px);
    color: #3a2410;
    background: linear-gradient(180deg, #f6dfa8, #d8a955);
    border-radius: 999px;
    padding: 0.4em 1.2em;
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    box-shadow:
        0 3px 0 #8a5d22,
        0 5px 12px rgba(0, 0, 0, 0.35);
}
/* Clay casino chips: a colored disc with a dashed white edge */
.chip {
    width: var(--chip);
    height: var(--chip);
    border-radius: 50%;
    font-weight: 800;
    font-size: max(10px, calc(var(--chip) * 0.25));
    color: #fff8ea;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
    background: radial-gradient(circle, var(--chip-color) 52%, transparent 53%),
        repeating-conic-gradient(#fff3dc 0 15deg, var(--chip-color) 15deg 45deg);
    box-shadow:
        inset 0 0 0 calc(var(--chip) * 0.05) var(--chip-color),
        0 3px 0 rgba(0, 0, 0, 0.45),
        0 5px 10px rgba(0, 0, 0, 0.3);
}
.hint {
    font:
        italic 14px Georgia,
        serif;
    color: rgba(246, 236, 216, 0.7);
}
/* Your result, big over the table for a moment */
.banner {
    position: absolute;
    left: 50%;
    top: 45%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    font:
        italic 800 clamp(26px, 9cqh, 76px) Georgia,
        serif;
    white-space: nowrap;
    /* A pool of shade under the words, so whatever is on the felt behind doesn't read through */
    padding: 0.35em 1.4em;
    background: radial-gradient(ellipse closest-side, rgba(6, 22, 15, 0.85), rgba(6, 22, 15, 0.6) 60%, transparent);
    color: var(--cream);
    text-shadow:
        0 0 24px rgba(0, 0, 0, 0.6),
        0 3px 0 rgba(0, 0, 0, 0.5);
    opacity: 0;
    animation: banner 2.6s ease-out 0.4s forwards;
}
.banner.blackjack,
.banner.win {
    color: #ffd98a;
    text-shadow:
        0 0 28px rgba(255, 170, 60, 0.75),
        0 3px 0 rgba(70, 35, 0, 0.6);
}
.banner.lose,
.banner.bust {
    color: #ffb4a6;
}
@keyframes banner {
    0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.7);
    }
    15% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.06);
    }
    25%,
    75% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
    100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1);
    }
}
@media (prefers-reduced-motion: no-preference) {
    .felt::before {
        animation: lamp 7s ease-in-out infinite;
    }
    @keyframes lamp {
        50% {
            opacity: 0.75;
        }
    }
}
@media (prefers-reduced-motion: reduce) {
    .clock {
        display: none;
    }
    .banner {
        animation: none;
        opacity: 1;
    }
}

/* Shorter players: tighter hands so the seats keep their cards on screen */
@container (max-height: 300px) {
    .printed {
        display: none;
    }
    .felt :deep(.hand) {
        gap: 1px;
        padding-block: 2px;
    }
}

/* Short players (the smallest size): one row with the status, the dealer, your hand and your buttons */
@container (max-height: 180px) {
    .casino {
        padding: 0;
    }
    .felt {
        --card-h: clamp(24px, 34cqh, 52px);
        --chip: clamp(30px, 22cqh, 40px);
        grid-template-rows: minmax(0, 1fr);
        grid-auto-flow: column;
        /* The buttons keep their width and the seats give way, so they never slide over a hand */
        grid-template-columns: minmax(0, auto) auto minmax(0, 1fr) auto;
        align-items: center;
        padding-block: 4px;
        border-radius: 0;
    }
    .top {
        flex-direction: column;
        align-items: flex-start;
    }
    .title,
    .limits,
    .banner {
        display: none;
    }
    /* A fixed width, so the dealer and the seats don't slide sideways when the status text changes */
    .status {
        white-space: normal;
        text-align: left;
        width: 18ch;
    }
    /* One row: seats line up and scroll sideways when there are many */
    .seats {
        flex-wrap: nowrap;
        justify-content: flex-start;
        overflow: auto hidden;
    }
    /* Two by two, so the buttons fit the short height however many seats squeeze them */
    .actions {
        display: grid;
        grid-template-columns: repeat(2, auto);
        gap: 4px;
        justify-content: end;
        min-height: 0;
    }
    /* Icons only, the title names them */
    .action {
        padding: 0.45em 0.7em;
    }
    .action .label {
        display: none;
    }
}

/* Short and narrow (the smallest player on a phone): tighter, so everything still fits on one row */
@container (max-height: 180px) and (max-width: 520px) {
    .seat.other,
    .mute {
        display: none;
    }
    .others {
        display: block;
    }
    .felt {
        --card-h: clamp(22px, 30cqh, 34px);
        --chip: 32px;
        --hand-w: calc(var(--card-h) * 2.4 + 32px);
        column-gap: 6px;
        padding-inline: 6px;
    }
    /* The dealer has no name or balance to show, its cards are enough */
    .dealer {
        --hand-w: calc(var(--card-h) * 2 + 20px);
        padding-inline: 0;
    }
    .status {
        width: 9ch;
        font-size: 11px;
    }
    .action {
        font-size: 13px;
    }
}

/* Narrow players (phones): smaller cards so a few seats fit side by side */
@container (max-width: 480px) {
    .felt {
        --card-h: clamp(26px, 11cqh, 52px);
    }
    .limits {
        display: none;
    }
    .printed {
        letter-spacing: 0.5px;
        font-size: 9px;
    }
}
/* Tall phones: three seats per row */
@container (max-width: 480px) and (min-height: 181px) {
    .felt {
        --hand-w: 30cqw;
    }
}
</style>
