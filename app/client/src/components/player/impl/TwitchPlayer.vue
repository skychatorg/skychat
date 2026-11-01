<script setup>
import { ref, watch, onMounted } from 'vue';
import { useClientStore } from '@/stores/client';

const client = useClientStore();

const src = ref('');
const previousVideoHash = ref(null);

const updateSrc = () => {
    if (!client.state.player.current) {
        return;
    }

    // If video did not change since last sync, pass
    const videoHash = JSON.stringify(client.state.player.current.video);
    if (videoHash === previousVideoHash.value) {
        return;
    }

    // Build new URL/src
    let newSrc = 'https://player.twitch.tv/';
    newSrc += `?channel=${client.state.player.current.video.id}`;
    newSrc += `&parent=${document.location.hostname}`;
    src.value = newSrc + '&random=' + Math.random();

    // Save new hash
    previousVideoHash.value = videoHash;
};

watch(() => client.state.player.current && client.state.player.current.video, updateSrc);
onMounted(updateSrc);
</script>

<template>
    <iframe :src="src" class="w-full h-full" frameborder="0" allowfullscreen="true" scrolling="no"></iframe>
</template>

<style scoped></style>
