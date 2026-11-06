<script setup>
import { computed, inject, ref, watch } from 'vue';

const props = defineProps({
    // { rank, suit }, or null for a face-down card
    card: {
        type: Object,
        default: null,
    },
    // Wait before sliding in, so a deal reads as one card after the other
    dealDelayMs: {
        type: Number,
        default: 0,
    },
});

// Cards already on the table when it mounts don't fly in again
const dealtIn = !inject('casinoMounting', ref(false)).value;

const SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };

// The face keeps showing the last card while it flips down, and gets the card as soon as it flips up
const face = ref(props.card);
watch(
    () => props.card,
    (card) => card && (face.value = card),
);

const red = computed(() => face.value && ['♥', '♦'].includes(face.value.suit));
const label = computed(() => (props.card ? `${props.card.rank} of ${SUIT_NAMES[props.card.suit]}` : 'Face-down card'));
</script>

<template>
    <span
        class="playing-card"
        :class="{ 'dealt-in': dealtIn }"
        role="img"
        :aria-label="label"
        :style="{ '--deal-delay': `${dealDelayMs}ms` }"
    >
        <span class="inner" :class="{ down: !card }">
            <span class="face front" :class="{ red }">
                <template v-if="face">
                    <span class="corner">{{ face.rank }}</span>
                    <span class="rank">{{ face.rank }}</span>
                    <span class="suit">{{ face.suit }}</span>
                </template>
            </span>
            <span class="face back"></span>
        </span>
    </span>
</template>

<style scoped>
/* Sized by the table through --card-h, so the same card works from the smallest player to cinema mode */
.playing-card {
    height: var(--card-h, 48px);
    width: calc(var(--card-h, 48px) * 0.7);
    flex: none;
    perspective: calc(var(--card-h, 48px) * 6);
}
.inner {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.55s cubic-bezier(0.3, 1.4, 0.5, 1);
}
.inner.down {
    transform: rotateY(180deg);
}
.face {
    position: absolute;
    inset: 0;
    border-radius: calc(var(--card-h, 48px) * 0.1);
    backface-visibility: hidden;
    box-shadow:
        0 calc(var(--card-h, 48px) * 0.04) calc(var(--card-h, 48px) * 0.08) rgba(20, 8, 0, 0.45),
        inset 0 0 0 1px rgba(120, 90, 50, 0.25);
}
.front {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(160deg, #fffaf0, #f1e6d0);
    color: #24201c;
    line-height: 1;
    font-weight: 700;
}
.red {
    color: #b83227;
}
.corner {
    position: absolute;
    top: 6%;
    left: 9%;
    font-size: calc(var(--card-h, 48px) * 0.14);
    opacity: 0.7;
}
.rank {
    font-size: calc(var(--card-h, 48px) * 0.34);
}
.suit {
    font-size: calc(var(--card-h, 48px) * 0.3);
}
/* A burgundy back with a gold inner frame, like an old casino deck */
.back {
    transform: rotateY(180deg);
    background: radial-gradient(circle at 50% 50%, rgba(255, 210, 140, 0.25), transparent 60%),
        repeating-linear-gradient(45deg, #8a2a2a 0 3px, #6c1d22 3px 6px);
    border: calc(var(--card-h, 48px) * 0.04) solid #fbf3e2;
    box-shadow:
        0 calc(var(--card-h, 48px) * 0.04) calc(var(--card-h, 48px) * 0.08) rgba(20, 8, 0, 0.45),
        inset 0 0 0 calc(var(--card-h, 48px) * 0.03) #d9a54a;
}
@media (prefers-reduced-motion: no-preference) {
    /* Dealt from the shoe, top right of the table */
    .dealt-in {
        animation: deal 0.42s cubic-bezier(0.2, 0.9, 0.3, 1.05) var(--deal-delay) backwards;
    }
    @keyframes deal {
        from {
            transform: translate(calc(var(--card-h, 48px) * 2.5), calc(var(--card-h, 48px) * -1.6)) rotate(25deg) scale(0.8);
            opacity: 0;
        }
    }
}
@media (prefers-reduced-motion: reduce) {
    .inner {
        transition: none;
    }
}
</style>
