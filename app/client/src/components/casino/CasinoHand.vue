<script setup>
import CasinoChip from '@/components/casino/CasinoChip.vue';
import PlayingCard from '@/components/casino/PlayingCard.vue';
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';
import { formatMoney } from '../../../../api/money.ts';
import { ref, watch } from 'vue';

const props = defineProps({
    name: {
        type: String,
        required: true,
    },
    color: {
        type: String,
        default: 'inherit',
    },
    // The seated player, for the avatar
    user: {
        type: Object,
        default: null,
    },
    cards: {
        type: Array,
        default: () => [],
    },
    // When each card slides in, by its index in the hand
    cardDelay: {
        type: Function,
        default: () => 0,
    },
    // What sits under the cards: a total, an outcome, "Waiting for cards"
    result: {
        type: String,
        default: '',
    },
    tone: {
        type: String,
        default: '',
        validator: (tone) => ['', 'good', 'bad', 'muted'].includes(tone),
    },
    // The player's balance, under the name
    money: {
        type: Number,
        default: null,
    },
    bet: {
        type: Number,
        default: null,
    },
    // The bet as chips: { value, color }
    chips: {
        type: Array,
        default: () => [],
    },
    // Once the hand is settled: blackjack, win, push, lose or bust, and the money won or lost
    outcome: {
        type: String,
        default: null,
    },
    net: {
        type: Number,
        default: 0,
    },
    // Highlights your own seat
    mine: {
        type: Boolean,
        default: false,
    },
    // Your turn to play this hand
    active: {
        type: Boolean,
        default: false,
    },
});

const COINS = 10;

// Celebrate an outcome that lands while you watch, not one found on mount
const celebrate = ref(false);
watch(
    () => props.outcome,
    (outcome) => (celebrate.value = !!outcome),
);
</script>

<template>
    <div class="hand" :class="[{ mine, active, celebrate }, outcome && `outcome-${outcome}`]">
        <div class="who">
            <UserMiniAvatar v-if="user" :user="user" class="avatar" />
            <span class="name" :style="{ color }">{{ name }}</span>
        </div>
        <!-- Always there, even empty, so every hand has the same height -->
        <div class="purse">
            <span v-if="money !== null" class="money">{{ formatMoney(money) }}</span>
        </div>
        <div class="cards" :style="{ '--n': cards.length, '--stake': chips.length ? 1 : 0 }">
            <span v-if="chips.length" class="stake" :title="`Bet ${formatMoney(bet)}`">
                <CasinoChip v-for="(chip, index) in chips" :key="index" :value="chip.value" :color="chip.color" />
            </span>
            <PlayingCard v-for="(card, index) in cards" :key="index" :card="card" :deal-delay-ms="cardDelay(index)" />
        </div>
        <!-- Always there, even empty, so the hand keeps its height when the first total shows -->
        <div class="result" :class="tone">{{ result || '\u00a0' }}</div>

        <!-- Effects only: they never take clicks -->
        <template v-if="celebrate && net > 0">
            <span class="pop" aria-hidden="true">+{{ formatMoney(net) }}</span>
            <span class="coins" aria-hidden="true">
                <span v-for="i in outcome === 'blackjack' ? COINS * 2 : COINS" :key="i" class="coin" :style="{ '--i': i }"></span>
            </span>
        </template>
    </div>
</template>

<style scoped>
.hand {
    /* Every hand has the table's width, whatever the name or the number of cards */
    width: var(--hand-w, auto);
    flex: none;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-radius: 12px;
    transition:
        box-shadow 0.4s,
        background 0.4s,
        opacity 0.4s;
}
.mine {
    background: rgba(255, 214, 150, 0.08);
    box-shadow: inset 0 0 0 1px rgba(232, 182, 92, 0.45);
}
.who {
    --avatar: clamp(16px, calc(var(--card-h, 48px) * 0.32), 32px);
    display: flex;
    gap: 6px;
    align-items: center;
    max-width: 100%;
    /* As tall as an avatar, so the open seat and the dealer line up with the players */
    min-height: var(--avatar);
}
.avatar {
    width: var(--avatar);
    height: var(--avatar);
    flex: none;
}
.name {
    font-weight: 700;
    font-size: clamp(12px, calc(var(--card-h, 48px) * 0.16), 18px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.purse {
    display: flex;
    gap: 8px;
    justify-content: center;
    max-width: 100%;
    min-height: 1lh;
    font:
        600 clamp(11px, calc(var(--card-h, 48px) * 0.12), 16px) ui-monospace,
        monospace;
    line-height: 1.2;
}
.money {
    color: rgba(246, 236, 216, 0.75);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
/* The bet, as a stack of chips next to the cards */
.stake {
    --stake-w: calc(var(--card-h, 48px) * 0.6);
    display: flex;
    flex-direction: column-reverse;
    flex: none;
    align-self: center;
    width: var(--stake-w);
    margin-right: 6px;
}
.stake > * + * {
    margin-bottom: -82%;
}
.cards {
    display: flex;
    min-height: var(--card-h, 48px);
    justify-content: center;
}
/* Cards overlap as much as needed to stay inside the hand */
.cards > .playing-card + .playing-card {
    margin-left: min(
        4px,
        calc(
            (var(--hand-w) - 16px - var(--stake) * (var(--card-h, 48px) * 0.6 + 6px) - var(--n) * var(--card-h, 48px) * 0.7) /
                (var(--n) - 1)
        )
    );
}
.result {
    font:
        700 clamp(12px, calc(var(--card-h, 48px) * 0.15), 18px) ui-monospace,
        monospace;
    color: #f6ecd8;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
}
.good {
    color: #9be7b4;
}
.bad {
    color: #ff9a8a;
}
.muted {
    color: rgba(246, 236, 216, 0.6);
}

/* Settled hands */
.outcome-win,
.outcome-blackjack {
    box-shadow:
        inset 0 0 0 1px rgba(255, 210, 120, 0.8),
        0 0 24px rgba(255, 190, 90, 0.35);
}
.outcome-lose .cards,
.outcome-bust .cards {
    opacity: 0.6;
    filter: saturate(0.6);
    transition:
        opacity 0.5s,
        filter 0.5s;
}

.pop,
.coins {
    position: absolute;
    left: 50%;
    top: 45%;
    pointer-events: none;
}
.pop {
    transform: translate(-50%, -50%);
    font:
        800 clamp(14px, calc(var(--card-h, 48px) * 0.26), 30px) Georgia,
        serif;
    color: #ffd98a;
    text-shadow:
        0 0 12px rgba(255, 180, 60, 0.8),
        0 2px 0 rgba(60, 30, 0, 0.6);
    opacity: 0;
}
.coin {
    position: absolute;
    width: calc(var(--card-h, 48px) * 0.14);
    height: calc(var(--card-h, 48px) * 0.14);
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #fff2c0, #e9b23c 55%, #a86f12);
    opacity: 0;
}

@media (prefers-reduced-motion: no-preference) {
    .active {
        animation: breathe 1.8s ease-in-out infinite;
    }
    @keyframes breathe {
        50% {
            box-shadow:
                inset 0 0 0 1px rgba(255, 210, 120, 0.9),
                0 0 22px rgba(255, 190, 90, 0.4);
        }
    }
    .celebrate.outcome-bust {
        animation: shake 0.45s ease-in-out;
    }
    @keyframes shake {
        25% {
            transform: translateX(-4px) rotate(-1deg);
        }
        50% {
            transform: translateX(4px) rotate(1deg);
        }
        75% {
            transform: translateX(-2px);
        }
    }
    .celebrate.outcome-blackjack .cards {
        animation: shine 1.2s ease-out 0.2s;
    }
    @keyframes shine {
        40% {
            filter: drop-shadow(0 0 10px #ffd27a) brightness(1.15);
            transform: translateY(-3px);
        }
    }
    .pop {
        animation: pop 2.2s ease-out 0.3s forwards;
    }
    @keyframes pop {
        0% {
            opacity: 0;
            transform: translate(-50%, -20%) scale(0.6);
        }
        20% {
            opacity: 1;
            transform: translate(-50%, -60%) scale(1.15);
        }
        70% {
            opacity: 1;
            transform: translate(-50%, -110%) scale(1);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -150%) scale(1);
        }
    }
    /* Each coin flies out on its own angle, then falls a little */
    .coin {
        animation: coin 1.1s cubic-bezier(0.15, 0.7, 0.4, 1) calc(0.25s + var(--i) * 0.02s) forwards;
    }
    @keyframes coin {
        0% {
            opacity: 1;
            transform: rotate(calc(var(--i) * 37deg)) translateY(0);
        }
        70% {
            opacity: 1;
        }
        100% {
            opacity: 0;
            transform: rotate(calc(var(--i) * 37deg)) translateY(calc(var(--card-h, 48px) * -1.1)) rotate(calc(var(--i) * -37deg))
                translateY(12px);
        }
    }
}
/* Without motion, the winnings still show, just without flying */
@media (prefers-reduced-motion: reduce) {
    .pop {
        opacity: 1;
        top: 0;
    }
}
</style>
