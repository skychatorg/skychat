<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import YoutubePlayer from '@/components/player/impl/YoutubePlayer.vue';
import TwitchPlayer from '@/components/player/impl/TwitchPlayer.vue';
import GalleryPlayer from '@/components/player/impl/GalleryPlayer.vue';
import IFramePlayer from '@/components/player/impl/IFramePlayer.vue';
import JellyfinPlayer from '@/components/player/impl/JellyfinPlayer.vue';

const app = useAppStore();
const client = useClientStore();

const playerImpl = computed(() => {
    if (!client.state.player.current) {
        return null;
    }
    return (
        {
            youtube: YoutubePlayer,
            twitch: TwitchPlayer,
            gallery: GalleryPlayer,
            iframe: IFramePlayer,
            jellyfin: JellyfinPlayer,
        }[client.state.player.current.video.type] || null
    );
});
</script>

<template>
    <div>
        <component :is="playerImpl" v-if="app.playerMode.enabled && playerImpl" />
    </div>
</template>

<style scoped></style>
