<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import YoutubePlayer from '@/components/player/impl/YoutubePlayer.vue';
import TwitchPlayer from '@/components/player/impl/TwitchPlayer.vue';
import EmbedPlayer from '@/components/player/impl/EmbedPlayer.vue';

const app = useAppStore();
const client = useClientStore();

const playerImpl = computed(() => {
    if (! client.state.player.current) {
        return null;
    }
    return {
        youtube: YoutubePlayer,
        twitch: TwitchPlayer,
        embed: EmbedPlayer,
    }[client.state.player.current.video.type] || null;
});

</script>

<template>
    <div>
        <component v-if="app.playerMode.enabled && playerImpl" :is="playerImpl" />
    </div>
</template>

<style scoped>
</style>
