<script setup>
import { formatMoney } from '../../../../api/money.ts';

defineProps({
    // In cents
    value: {
        type: Number,
        required: true,
    },
    color: {
        type: String,
        required: true,
    },
});
</script>

<template>
    <!-- Sized by its parent: the label scales with the chip -->
    <span class="casino-chip" :style="{ '--chip-color': color }">
        <span class="label">{{ formatMoney(value) }}</span>
    </span>
</template>

<style scoped>
/* Clay casino chip: a colored disc with a dashed white edge */
.casino-chip {
    container-type: inline-size;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle, var(--chip-color) 52%, transparent 53%),
        repeating-conic-gradient(#fff3dc 0 15deg, var(--chip-color) 15deg 45deg);
    box-shadow:
        inset 0 0 0 2px var(--chip-color),
        0 2px 0 rgba(0, 0, 0, 0.45),
        0 4px 8px rgba(0, 0, 0, 0.3);
}
.label {
    font-weight: 800;
    font-size: max(9px, 25cqw);
    color: #fff8ea;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
    white-space: nowrap;
}
/* Too small to read: the color tells the value */
@container (max-width: 21px) {
    .label {
        display: none;
    }
}
</style>
