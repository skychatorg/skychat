<script setup>
import { ref, watch, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';

const app = useAppStore();
const client = useClientStore();

const player = ref(null);
const src = ref('');
const previousVideoHash = ref(null);

const updateSrc = () => {
    if (! client.state.player.current) {
        return;
    }

    // If video did not change since last sync, pass
    const videoHash = JSON.stringify(client.state.player.current.video);
    if (videoHash === previousVideoHash.value) {
        return;
    }

    // Build new URL/src
    let newSrc = 'https://www.youtube.com/embed/' + client.state.player.current.video.id;
    newSrc += '?autoplay=1';
    newSrc += '&origin=' + document.location.origin;
    if (client.state.player.current.video.duration > 0) {
        const timeSinceLastUpdate = new Date().getTime() - client.state.playerLastUpdate.getTime();
        const startTimeMs = client.state.player.cursor + timeSinceLastUpdate;
        newSrc += '&start=' + parseInt(startTimeMs / 1000);
    }
    src.value = newSrc + '&random=' + Math.random();

    // Save new hash
    previousVideoHash.value = videoHash;
}

watch(() => client.state.player.current && client.state.player.current.video, updateSrc);
onMounted(updateSrc);

</script>

<template>
    <iframe
        ref="player"
        class="h-full w-full"
        :src="src"
        frameborder="0"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>
</template>

<style scoped>
</style>
