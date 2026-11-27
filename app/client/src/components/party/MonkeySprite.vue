<script setup>
import { computed } from 'vue';

/**
 * A killer monkey drawn from the server's skin indices: fur, face, eyes and one piece of gear
 */
const props = defineProps({
    skin: { type: Object, required: true },
    ko: { type: Boolean, default: false },
});

const FURS = ['#2b2420', '#4a3020', '#4a4a50', '#6b4426', '#7a7a80', '#4a1f1c', '#1c1c22', '#7a5230'];
const FACES = ['#b08a6e', '#8f6a55', '#a07f72', '#c7a58c'];
// Red glow, feral yellow, or red with a scar across the eye
const EYES = [
    { color: '#ff2a2a', scar: false },
    { color: '#ffc21a', scar: false },
    { color: '#ff2a2a', scar: true },
];

const fur = computed(() => FURS[props.skin.fur % FURS.length]);
const face = computed(() => FACES[props.skin.face % FACES.length]);
const eye = computed(() => EYES[props.skin.eyes % EYES.length]);
const gear = computed(() => props.skin.accessory);
</script>

<template>
    <svg viewBox="0 0 100 110" class="monkey" aria-hidden="true">
        <!-- Hunched shoulders and long arms, knuckles down -->
        <path d="M20 70q30-24 60 0l6 30q-36 14-72 0z" :fill="fur" />
        <path d="M22 66q-14 14-10 36" :stroke="fur" stroke-width="13" stroke-linecap="round" fill="none" />
        <path d="M78 66q14 14 10 36" :stroke="fur" stroke-width="13" stroke-linecap="round" fill="none" />
        <circle cx="12" cy="102" r="8" :fill="face" />
        <circle cx="88" cy="102" r="8" :fill="face" />
        <path d="M8 99h8M84 99h8" stroke="rgb(0 0 0 / 0.35)" stroke-width="1.5" />
        <ellipse cx="50" cy="86" rx="14" ry="12" :fill="face" opacity="0.45" />

        <!-- Gear on the body -->
        <g v-if="gear === 4">
            <path d="M30 62q20 10 40 0" stroke="#222" stroke-width="7" fill="none" />
            <path d="M32 62l-2 7M41 66l-1 7M50 68v7M59 66l1 7M68 62l2 7" stroke="#bbb" stroke-width="3" stroke-linecap="round" />
        </g>
        <g v-else-if="gear === 5">
            <path d="M26 64l48 36" stroke="#4a3a20" stroke-width="7" />
            <path d="M32 68l3-4M40 74l3-4M48 80l3-4M56 86l3-4M64 92l3-4" stroke="#d9a23a" stroke-width="3.5" stroke-linecap="round" />
        </g>

        <!-- Small ears, low brow, heavy jaw -->
        <circle cx="22" cy="36" r="8" :fill="fur" />
        <circle cx="78" cy="36" r="8" :fill="fur" />
        <circle cx="22" cy="36" r="4" :fill="face" />
        <circle cx="78" cy="36" r="4" :fill="face" />
        <path d="M24 40q0-30 26-30t26 30q0 22-26 24t-26-24z" :fill="fur" />
        <path d="M31 36q19-8 38 0q2 18-19 24q-21-6-19-24z" :fill="face" />

        <!-- Eyes: KO'd ones are crosses -->
        <g v-if="ko" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round">
            <path d="M37 33l6 6M43 33l-6 6M57 33l6 6M63 33l-6 6" />
        </g>
        <g v-else>
            <ellipse cx="40" cy="36" rx="4.5" ry="3" :fill="eye.color" class="glow" :style="{ '--eye': eye.color }" />
            <ellipse cx="60" cy="36" rx="4.5" ry="3" :fill="eye.color" class="glow" :style="{ '--eye': eye.color }" />
            <circle cx="40" cy="36" r="1.3" fill="#1a0000" />
            <circle cx="60" cy="36" r="1.3" fill="#1a0000" />
        </g>
        <!-- The brow: always furious -->
        <path d="M31 27l14 6M69 27l-14 6" :stroke="fur" stroke-width="5" stroke-linecap="round" />
        <path v-if="eye.scar" d="M56 26l9 16" stroke="#d65a5a" stroke-width="1.8" stroke-linecap="round" />

        <!-- Nose and snarl, fangs out -->
        <path d="M46 43q4 3 8 0" stroke="#3a2418" stroke-width="2" fill="none" stroke-linecap="round" />
        <template v-if="ko">
            <path d="M40 51q10-4 20 0" stroke="#3a2418" stroke-width="2.2" fill="none" />
            <path d="M51 51q5 8 0 11q-5-2-1-11z" fill="#c4485e" />
        </template>
        <g v-else>
            <path d="M38 49q12-4 24 0q-2 9-12 9t-12-9z" fill="#3a0d10" />
            <path d="M40 49.5l2.5 6 2-6M55.5 49.5l2 6 2.5-6" fill="#f2ead8" />
            <path d="M45 57.5l1.5-3.5 1.5 3.5M52 57.5l1.5-3.5 1.5 3.5" fill="#f2ead8" />
        </g>

        <!-- Gear on the head -->
        <g v-if="gear === 1">
            <path d="M22 26q28-22 56 0v-6q-28-18-56 0z" fill="#5a4636" />
            <path d="M22 20q28-26 56 0l-2-10q-26-14-52 0z" fill="#3a3a3a" />
            <path d="M22 24q-6 8-4 20M78 24q6 8 4 20" stroke="#5a4636" stroke-width="7" stroke-linecap="round" />
            <circle cx="50" cy="14" r="3.5" fill="#b8202a" />
        </g>
        <g v-else-if="gear === 2">
            <path d="M25 26q25-11 50 0l-1 6q-24-10-48 0z" fill="#9c1b22" />
            <path d="M74 28l12 3-9 6z" fill="#9c1b22" />
        </g>
        <g v-else-if="gear === 3 && !ko">
            <ellipse cx="60" cy="36" rx="7" ry="6" fill="#111" />
            <path d="M24 30l46 2M70 32l8 -2" stroke="#111" stroke-width="1.8" />
        </g>
        <g v-else-if="gear === 6">
            <path d="M32 40l6 4M32 44l6 4M62 44l6-4M62 48l6-4" stroke="#b8202a" stroke-width="2.4" stroke-linecap="round" />
        </g>
    </svg>
</template>

<style scoped>
.monkey {
    width: 100%;
    height: 100%;
    overflow: visible;
}
.glow {
    filter: drop-shadow(0 0 3px var(--eye));
}
</style>
