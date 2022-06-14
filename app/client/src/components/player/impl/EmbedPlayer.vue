<script setup>
import { ref, watch, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';

const app = useAppStore();
const client = useClientStore();

const player = ref(null);
const src = ref('');
const videoType = ref('');
const previousVideoHash = ref(null);

const updateSrc = () => {
    if (! client.state.player.current) {
        return;
    }
    
    // Get current cursor time
    const timeSinceLastUpdate = new Date().getTime() - client.state.playerStateLastUpdate.getTime();
    const currentTime = parseInt((client.state.player.cursor + timeSinceLastUpdate) / 1000);
    const videoHash = JSON.stringify(client.state.player.current.video.id);
    if (videoHash === previousVideoHash.value) {
        // If video did not change since last sync, update time
        player.value.currentTime = currentTime;
        return;
    }

    // If new video, update the player
    src.value = `${client.state.player.current.video.id}#t=${currentTime}`;
    const extension = client.state.player.current.video.id.match(/\.([a-z0-9]+)$/)[1];
    videoType.value = 'video/' + extension;

    // On next tick, update the video stream info
    previousVideoHash.value = videoHash;
}

watch(() => client.state.player.current && client.state.player.current.video, updateSrc);
onMounted(updateSrc);

</script>

<template>
    <video
        ref="player"
        class="w-full h-full"
        controls=""
        autoplay="1"
        :src="src"
        name="media"
    >
        <source :src="src" :type="videoType">
    </video>
</template>

<style scoped>
</style>
