<script setup>
import { ref, watch, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { roomCursorMs } from '@/lib/player.js';

const app = useAppStore();
const client = useClientStore();

const player = ref(null);
const src = ref('');
const previousVideoHash = ref(null);

const updateSrc = () => {
    if (!client.state.player.current) {
        return;
    }

    // If video did not change since last sync, pass. A forced sync (the "Synchronize" button or a
    // countdown resync) reloads anyway: a bare iframe exposes no position, so reloading at the room
    // cursor is the only correction available.
    const videoHash = JSON.stringify(client.state.player.current.video);
    if (videoHash === previousVideoHash.value && !client.state.player.forced) {
        return;
    }

    // Build new URL/src
    let newSrc = 'https://www.youtube.com/embed/' + client.state.player.current.video.id;
    newSrc += '?autoplay=1';
    newSrc += '&origin=' + document.location.origin;
    if (client.state.player.current.video.duration > 0) {
        const startTimeMs = roomCursorMs(client.state.player, client.state.playerLastUpdate);
        newSrc += '&start=' + parseInt(startTimeMs / 1000);
    }
    src.value = newSrc + '&random=' + Math.random();

    // Save new hash
    previousVideoHash.value = videoHash;
};

// Watch the sync date, not just the video: a forced sync can arrive with an unchanged video object
watch(() => client.state.playerLastUpdate, updateSrc);
onMounted(updateSrc);
</script>

<template>
    <iframe
        ref="player"
        class="h-full w-full"
        :src="src"
        frameborder="0"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
    ></iframe>
</template>

<style scoped></style>
