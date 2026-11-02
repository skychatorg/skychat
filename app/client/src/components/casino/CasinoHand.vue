<script setup>
import PlayingCard from '@/components/casino/PlayingCard.vue';
import { formatMoney } from '../../../../api/money.ts';

defineProps({
    name: {
        type: String,
        required: true,
    },
    color: {
        type: String,
        default: 'inherit',
    },
    cards: {
        type: Array,
        default: () => [],
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
    bet: {
        type: Number,
        default: null,
    },
    // Highlights your own seat
    mine: {
        type: Boolean,
        default: false,
    },
});
</script>

<template>
    <div class="hand" :class="{ mine }">
        <div class="who">
            <span class="name" :style="{ color }">{{ name }}</span>
            <span v-if="bet !== null" class="bet">{{ formatMoney(bet) }}</span>
        </div>
        <div class="cards">
            <PlayingCard v-for="(card, index) in cards" :key="index" :card="card" />
        </div>
        <div v-if="result" class="result" :class="tone">{{ result }}</div>
    </div>
</template>

<style scoped>
.hand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-radius: 10px;
    min-width: 0;
}
.mine {
    background: rgba(226, 176, 74, 0.1);
    box-shadow: inset 0 0 0 1px rgba(226, 176, 74, 0.5);
}
.who {
    display: flex;
    gap: 6px;
    align-items: baseline;
    max-width: 100%;
}
.name {
    font-weight: 700;
    font-size: clamp(12px, calc(var(--card-h, 48px) * 0.16), 18px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.bet {
    font:
        600 11px ui-monospace,
        monospace;
    color: #e2b04a;
}
.cards {
    display: flex;
    gap: 4px;
    min-height: var(--card-h, 48px);
    justify-content: center;
}
.result {
    font:
        700 clamp(12px, calc(var(--card-h, 48px) * 0.15), 18px) ui-monospace,
        monospace;
    color: #e7f1ec;
    white-space: nowrap;
}
.good {
    color: #6be0b0;
}
.bad {
    color: #ff8c84;
}
.muted {
    color: rgba(231, 241, 236, 0.6);
}
</style>
