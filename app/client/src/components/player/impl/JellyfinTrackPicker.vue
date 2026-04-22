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
    <!--
        Sits inline with (just left of) the player's top-right icon row, and fades in on hover to
        match it. right-40 clears the icon cluster (up to 4 × w-8 buttons + p-3 padding); max-w caps
        each select so long track labels don't sprawl across the video.
    -->
    <div
        class="absolute top-3 right-40 flex gap-2 text-xs opacity-0 transition pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
    >
        <select
            class="bg-black/60 text-white rounded px-2 py-1 outline-none max-w-40 truncate"
            :value="audio"
            title="Audio track"
            @change="emit('update:audio', $event.target.value)"
        >
            <option v-for="opt in audioOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <select
            class="bg-black/60 text-white rounded px-2 py-1 outline-none max-w-40 truncate"
            :value="sub"
            title="Subtitle track"
            @change="emit('update:sub', $event.target.value)"
        >
            <option v-for="opt in subtitleOptions" :key="opt.value" :value="opt.value" :disabled="opt.disabled">{{ opt.label }}</option>
        </select>
    </div>
</template>

<style scoped></style>
