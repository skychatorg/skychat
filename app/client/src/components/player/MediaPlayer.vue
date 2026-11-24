<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import YoutubePlayer from '@/components/player/impl/YoutubePlayer.vue';
import TwitchPlayer from '@/components/player/impl/TwitchPlayer.vue';
import IFramePlayer from '@/components/player/impl/IFramePlayer.vue';
import JellyfinPlayer from '@/components/player/impl/JellyfinPlayer.vue';
import NavidromePlayer from '@/components/player/impl/NavidromePlayer.vue';

const app = useAppStore();
const client = useClientStore();

// The side player plays even while the main player is hidden
const props = defineProps({ force: { type: Boolean, default: false } });

const playerImpl = computed(() => {
    if (!client.state.player.current) {
        return null;
    }
    return (
        {
            youtube: YoutubePlayer,
            twitch: TwitchPlayer,
            iframe: IFramePlayer,
            jellyfin: JellyfinPlayer,
            navidrome: NavidromePlayer,
        }[client.state.player.current.video.type] || null
    );
});
</script>

<template>
    <div>
        <component :is="playerImpl" v-if="(props.force || app.playerMode.enabled) && playerImpl" />
    </div>
</template>

<style scoped></style>
