<script setup>
import { computed } from 'vue';

const props = defineProps({
    // { rank, suit }, or null for a face-down card
    card: {
        type: Object,
        default: null,
    },
});

const SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };

const red = computed(() => props.card && ['♥', '♦'].includes(props.card.suit));
const label = computed(() => (props.card ? `${props.card.rank} of ${SUIT_NAMES[props.card.suit]}` : 'Face-down card'));
</script>

<template>
    <span class="playing-card" :class="{ back: !card, red }" role="img" :aria-label="label">
        <template v-if="card">
            <span class="rank">{{ card.rank }}</span>
            <span class="suit">{{ card.suit }}</span>
        </template>
    </span>
</template>

<style scoped>
/* Sized by the table through --card-h, so the same card works from the smallest player to cinema mode */
.playing-card {
    height: var(--card-h, 48px);
    width: calc(var(--card-h, 48px) * 0.7);
    border-radius: calc(var(--card-h, 48px) * 0.1);
    background: #f4f0e6;
    color: #1d1d26;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1;
    font-weight: 700;
    flex: none;
}
.rank {
    font-size: calc(var(--card-h, 48px) * 0.34);
}
.suit {
    font-size: calc(var(--card-h, 48px) * 0.3);
}
.red {
    color: #c0392b;
}
.back {
    background: repeating-linear-gradient(45deg, #8e2d2d 0 4px, #6e1f1f 4px 8px);
    border: 2px solid #f4f0e6;
}
@media (prefers-reduced-motion: no-preference) {
    .playing-card {
        animation: deal 0.25s ease-out;
    }
    @keyframes deal {
        from {
            transform: translateY(-8px);
            opacity: 0;
        }
    }
}
</style>
