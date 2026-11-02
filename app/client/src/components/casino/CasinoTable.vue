<script setup>
import CasinoHand from '@/components/casino/CasinoHand.vue';
import { useNow } from '@/composables/useNow';
import { betLimits } from '@/lib/channel';
import { formatMoney } from '../../../../api/money.ts';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const client = useClientStore();
const now = useNow();

const table = computed(() => client.state.casino);
const me = computed(() => client.state.user);
const mySeat = computed(() => table.value.seats.find((seat) => seat.user.id === me.value.id) ?? null);
const otherSeats = computed(() => table.value.seats.filter((seat) => seat !== mySeat.value));
const phase = computed(() => table.value.phase);

const secondsLeft = computed(() => (table.value.deadline ? Math.max(0, Math.ceil((table.value.deadline - now.value) / 1000)) : null));
const myTurn = computed(() => phase.value === 'playing' && mySeat.value && !mySeat.value.done);
const canBet = computed(() => !me.value.id || phase.value === 'waiting' || (phase.value === 'betting' && !mySeat.value));
const canDouble = computed(() => myTurn.value && mySeat.value.cards.length === 2 && me.value.money >= mySeat.value.bet);

// A few chips between the table limits, like 10 · 20 · 50 · 100
const betChoices = computed(() => {
    const { minBet, maxBet } = table.value;
    return [...new Set([minBet, minBet * 2, minBet * 5, maxBet].map((bet) => Math.min(bet, maxBet)))].sort((a, b) => a - b);
});

const status = computed(() => {
    switch (phase.value) {
        case 'waiting':
            return table.value.seats.length ? 'Hand over · bet to deal the next one' : 'Place a bet to deal a hand';
        case 'betting':
            return `Bets close in ${secondsLeft.value}s`;
        case 'playing':
            if (myTurn.value) {
                return `Your move · ${secondsLeft.value}s`;
            }
            return `${mySeat.value ? 'Waiting for the others' : 'Players are deciding'} · ${secondsLeft.value}s`;
        default:
            return 'Dealer draws';
    }
});

const dealerResult = computed(() => {
    const { cards, total } = table.value.dealer;
    if (!cards.length) {
        return '';
    }
    return total > 21 ? `${total} · bust` : String(total);
});

function seatResult(seat) {
    if (!seat.cards.length) {
        return { result: 'In', tone: 'muted' };
    }
    if (seat.outcome) {
        const net = seat.payout - seat.bet;
        const money = net > 0 ? `+${formatMoney(net)}` : formatMoney(net);
        const label = { blackjack: 'Blackjack', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust' }[seat.outcome];
        return { result: `${label} ${money}`, tone: net > 0 ? 'good' : net < 0 ? 'bad' : 'muted' };
    }
    if (seat.total > 21) {
        return { result: `${seat.total} · bust`, tone: 'bad' };
    }
    return { result: seat.done ? `${seat.total} · stand` : String(seat.total), tone: '' };
}

const play = (action) => client.sendMessage(`/casino ${action}`);
</script>

<template>
    <div class="casino">
        <div class="felt">
            <div class="top">
                <span class="title">Blackjack</span>
                <span class="status" role="status">{{ status }}</span>
                <span class="limits">{{ betLimits(table) }}</span>
            </div>

            <CasinoHand class="dealer" name="Dealer" color="#e2b04a" :cards="table.dealer.cards" :result="dealerResult" />

            <div class="seats">
                <CasinoHand
                    v-if="mySeat"
                    class="seat"
                    mine
                    :name="mySeat.user.username"
                    :color="mySeat.user.data.plugins.custom.color"
                    :cards="mySeat.cards"
                    :bet="mySeat.bet"
                    v-bind="seatResult(mySeat)"
                />
                <CasinoHand
                    v-for="seat in otherSeats"
                    :key="seat.user.id"
                    class="seat other"
                    :name="seat.user.username"
                    :color="seat.user.data.plugins.custom.color"
                    :cards="seat.cards"
                    :bet="seat.bet"
                    v-bind="seatResult(seat)"
                />
                <p v-if="!table.seats.length" class="empty">Seats are open, up to {{ table.maxSeats }} players</p>
            </div>

            <div class="actions">
                <template v-if="myTurn">
                    <button class="action" @click="play('hit')">Hit</button>
                    <button class="action" @click="play('stand')">Stand</button>
                    <button class="action" :disabled="!canDouble" @click="play('double')">Double</button>
                </template>
                <template v-else-if="canBet">
                    <span v-if="!me.id" class="hint">Log in to play</span>
                    <template v-else>
                        <button
                            v-for="bet in betChoices"
                            :key="bet"
                            class="action chip"
                            :disabled="me.money < bet"
                            :title="`Bet ${formatMoney(bet)}`"
                            @click="play(`bet ${bet}`)"
                        >
                            {{ formatMoney(bet) }}
                        </button>
                    </template>
                </template>
                <span v-else-if="mySeat && phase === 'betting'" class="hint">You’re in for {{ formatMoney(mySeat.bet) }}</span>
                <span v-else-if="mySeat && phase === 'playing'" class="hint">Waiting for the others</span>
                <span v-else class="hint">Watching</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* The table sizes itself from its own box (container queries), so it fits every player size, cinema mode and phones */
.casino {
    container-type: size;
    width: 100%;
    height: 100%;
}
.felt {
    --card-h: clamp(30px, 15cqh, 150px);
    height: 100%;
    display: grid;
    /* Rows keep their size and the free height goes around them, so a big player has no hole above the buttons */
    grid-template-rows: auto auto minmax(0, auto) auto;
    align-content: space-evenly;
    gap: clamp(4px, 2cqh, 16px);
    padding: clamp(6px, 2.5cqh, 24px) clamp(8px, 2.5cqw, 32px);
    background: radial-gradient(ellipse at 50% 15%, #1d5a44, #0f3326 70%);
    color: #f1ece0;
    overflow: hidden;
}
.top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
}
.title {
    font:
        700 15px Georgia,
        serif;
}
.status {
    font:
        600 clamp(11px, 2cqh, 16px) ui-monospace,
        monospace;
    letter-spacing: 0.5px;
    color: #cfe7dc;
    text-align: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.limits {
    font:
        600 11px ui-monospace,
        monospace;
    color: rgba(241, 236, 224, 0.6);
}
.seats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-content: flex-start;
    gap: clamp(4px, 1.5cqw, 14px);
    min-height: 0;
    overflow-y: auto;
}
.empty {
    margin: auto;
    font-size: 13px;
    color: rgba(241, 236, 224, 0.6);
}
.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    align-items: center;
}
.action {
    font-family: inherit;
    font-weight: 600;
    font-size: clamp(13px, 2.4cqh, 20px);
    color: #f1ece0;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid #8fb5a4;
    border-radius: 10px;
    padding: 0.4em 1.1em;
    cursor: pointer;
}
.action:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
}
.action:disabled {
    opacity: 0.35;
    cursor: default;
}
.action:focus-visible {
    outline: 2px solid #e2b04a;
    outline-offset: 2px;
}
.chip {
    border-color: #e2b04a;
    color: #e2b04a;
}
.hint {
    font-size: 13px;
    color: rgba(241, 236, 224, 0.7);
}

/* Short players (the smallest size): one row with the status, the dealer, your hand and your buttons */
@container (max-height: 180px) {
    .felt {
        --card-h: clamp(24px, 34cqh, 52px);
        grid-template-rows: minmax(0, 1fr);
        grid-auto-flow: column;
        grid-template-columns: minmax(0, auto) auto minmax(0, auto) minmax(0, 1fr);
        align-items: center;
        padding-block: 4px;
    }
    .top {
        flex-direction: column;
        align-items: flex-start;
    }
    .title,
    .limits,
    .seat.other,
    .empty {
        display: none;
    }
    .status {
        white-space: normal;
        text-align: left;
        max-width: 18ch;
    }
    .seats {
        overflow: visible;
    }
    .actions {
        justify-content: flex-end;
    }
}

/* Short and narrow (the smallest player on a phone): tighter, so everything still fits on one row */
@container (max-height: 180px) and (max-width: 520px) {
    .felt {
        --card-h: clamp(22px, 30cqh, 34px);
        column-gap: 6px;
        padding-inline: 6px;
    }
    .status {
        max-width: 9ch;
        font-size: 11px;
    }
    .actions {
        flex-wrap: nowrap;
        gap: 4px;
    }
    .action {
        padding: 4px 8px;
        font-size: 12px;
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
}
</style>
