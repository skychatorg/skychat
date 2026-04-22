<script setup>
import { ref, watch, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { roomCursorMs } from '@/lib/player';

const app = useAppStore();
const client = useClientStore();

const player = ref(null);
const src = ref('');
const videoType = ref('');
const previousVideoHash = ref(null);

const updateSrc = () => {
    if (!client.state.player.current) {
        return;
    }

    // Get current cursor time (shared helper freezes it while paused, so we stop chasing then).
    const currentTime = parseInt(roomCursorMs(client.state.player, client.state.playerLastUpdate) / 1000);
    const videoHash = JSON.stringify(client.state.player.current.video.id);
    if (videoHash === previousVideoHash.value) {
        // If player is too far un-synchronized, we force re-sync cursor
        if (Math.abs(currentTime - player.value.currentTime) > 10) {
            player.value.currentTime = currentTime;
        }
        return;
    }

    // If new video, update the player
    src.value = `${client.state.player.current.video.id}#t=${currentTime}`;
    const extension = client.state.player.current.video.id.match(/\.([a-z0-9]+)$/)[1];
    videoType.value = 'video/' + extension;

    // On next tick, update the video stream info
    previousVideoHash.value = videoHash;
};

watch(() => client.state.player.current && client.state.player.current.video, updateSrc);

// Drive the <video> from the shared paused flag. On resume, snap to the room cursor first
// (covers a seek that happened while paused), then play.
watch(
    () => client.state.player.paused,
    (paused) => {
        if (!player.value) return;
        if (paused) {
            player.value.pause();
        } else {
            player.value.currentTime = roomCursorMs(client.state.player, client.state.playerLastUpdate) / 1000;
            player.value.play()?.catch(() => {});
        }
    },
);

// Reject native un-pausing while the room is paused, so this viewer can't desync locally.
const onNativePlay = (event) => {
    if (client.state.player.paused) {
        event.target.pause();
    }
};

onMounted(updateSrc);
</script>

<template>
    <video ref="player" class="w-full h-full" controls="" autoplay="1" :src="src" name="media" @play="onNativePlay">
        <source :src="src" :type="videoType" />
    </video>
</template>

<style scoped></style>
