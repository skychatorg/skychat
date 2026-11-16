<script setup>
import { useAppStore } from '@/stores/app';
import { computed } from 'vue';

/**
 * A game's own sound switch: muting one game leaves the others on
 */
const props = defineProps({
    game: { type: String, required: true },
});

const app = useAppStore();
const on = computed(() => app.gameSound(props.game));
</script>

<template>
    <button class="mute" :title="on ? 'Mute the game' : 'Turn game sounds on'" :aria-pressed="!on" @click="app.toggleGameSound(game)">
        <fa :icon="on ? 'volume-high' : 'volume-xmark'" />
    </button>
</template>

<style scoped>
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
</style>
