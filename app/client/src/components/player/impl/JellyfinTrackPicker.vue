<script setup>
import { computed } from 'vue';

const props = defineProps({
    audioTracks: { type: Array, required: true },
    subtitleTracks: { type: Array, required: true },
    audio: { type: String, required: true },
    sub: { type: String, required: true },
});
const emit = defineEmits(['update:audio', 'update:sub']);

// List every track by stream index. We used to key by language, but many movie rips
// have tracks with empty Language and were invisible in the picker.
const audioOptions = computed(() => {
    const opts = [{ value: 'default', label: 'Audio: default' }];
    for (const t of props.audioTracks || []) {
        opts.push({ value: `idx:${t.index}`, label: `Audio: ${t.label}` });
    }
    return opts;
});

const subtitleOptions = computed(() => {
    // Sort text tracks before bitmap tracks so users see the playable options first.
    const tracks = [...(props.subtitleTracks || [])].sort((a, b) => {
        if (a.isTextBased !== b.isTextBased) return a.isTextBased ? -1 : 1;
        return a.index - b.index;
    });
    const opts = [
        { value: 'default', label: 'Subs: default' },
        { value: 'off', label: 'Subs: off' },
    ];
    for (const t of tracks) {
        opts.push({
            value: `idx:${t.index}`,
            label: `Subs: ${t.label}${t.isTextBased ? '' : ' (bitmap — not supported)'}`,
            disabled: !t.isTextBased,
        });
    }
    return opts;
});
</script>

<template>
    <!-- Rendered inside the player's control strip, never over the video: floating it there used to
         cover the embed's own controls, and forced a hand-tuned offset to dodge the icon row. -->
    <div class="strip-group hairline">
        <select
            class="strip-btn bg-transparent outline-none max-w-32 truncate"
            :value="audio"
            title="Audio track"
            @change="emit('update:audio', $event.target.value)"
        >
            <option v-for="opt in audioOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <select
            class="strip-btn bg-transparent outline-none max-w-32 truncate"
            :value="sub"
            title="Subtitle track"
            @change="emit('update:sub', $event.target.value)"
        >
            <option v-for="opt in subtitleOptions" :key="opt.value" :value="opt.value" :disabled="opt.disabled">{{ opt.label }}</option>
        </select>
    </div>
</template>

<style scoped></style>
