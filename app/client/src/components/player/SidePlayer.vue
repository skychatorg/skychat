<script setup>
import MediaPlayer from '@/components/player/MediaPlayer.vue';
import { PARTY_GAMES } from '@/lib/channel';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const client = useClientStore();

defineProps({
    /** The right column is folded: the media keeps playing, only a button to swap shows */
    compact: { type: Boolean, default: false },
});

// The channel you are in beside the one the player shows
const side = computed(() => client.sideChannel);
const isMedia = computed(() => side.value?.kind === 'media');
const title = computed(() => (isMedia.value ? client.state.player.current?.video?.title : null) ?? side.value?.name ?? '');
const game = computed(() => (side.value?.party?.game ? PARTY_GAMES[side.value.party.game] : null));

const leave = () => client.sendMessage(`/playerchannel leave ${side.value.id}`);
</script>

<template>
    <section v-if="side" class="side-player hairline" :class="{ compact }" :aria-label="`${side.name}, beside the player`">
        <button
            v-if="compact"
            class="w-full py-2 flex justify-center text-primary"
            :title="`Show ${side.name} in the player`"
            @click="client.swapPlayerChannels()"
        >
            <fa :icon="isMedia ? 'music' : 'dice'" />
        </button>
        <div v-else class="flex items-center gap-2 px-3 py-2">
            <fa :icon="isMedia ? 'music' : 'dice'" class="text-primary shrink-0" />
            <div class="min-w-0 flex-1">
                <div class="text-sm truncate" :title="title">{{ title }}</div>
                <div class="font-mono text-xs text-white/40 truncate">{{ side.name }}</div>
            </div>
            <button class="side-btn" :title="`Show ${side.name} in the player`" @click="client.swapPlayerChannels()">
                <fa icon="right-left" />
            </button>
            <button class="side-btn" :title="`Leave ${side.name}`" @click="leave">
                <fa icon="xmark" />
            </button>
        </div>
        <!-- Mounted even when folded, so the music never stops: only its box is hidden -->
        <div v-if="isMedia" v-show="!compact" class="aspect-video bg-black">
            <MediaPlayer force class="w-full h-full" />
        </div>
        <button v-else-if="!compact" class="game-card" @click="client.swapPlayerChannels()">
            <span class="text-2xl">{{ game?.emoji ?? '🎲' }}</span>
            <span class="text-sm">{{ game ? `${game.name} is on` : 'Lobby' }} · back to the game</span>
        </button>
    </section>
</template>

<style scoped>
.side-player {
    background: var(--surface-2);
    flex-shrink: 0;
}
.side-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    color: rgb(255 255 255 / 0.7);
}
.side-btn:hover {
    background: rgb(255 255 255 / 0.08);
    color: #fff;
}
.game-card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    text-align: left;
    color: rgb(255 255 255 / 0.8);
}
.game-card:hover {
    background: rgb(255 255 255 / 0.05);
}
</style>
