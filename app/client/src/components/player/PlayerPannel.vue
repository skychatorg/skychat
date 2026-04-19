<script setup>
import MediaPlayer from '@/components/player/MediaPlayer.vue';
import UserMiniAvatarCollection from '@/components/user/UserMiniAvatarCollection.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const app = useAppStore();
const client = useClientStore();

const showPlayer = computed(() => {
    return client.state.player.current && app.playerMode.enabled;
});

const playerHeightCss = computed(() => {
    if (!showPlayer.value) {
        return 'auto';
    }
    return {
        xs: '100px',
        sm: '20vh',
        md: '35vh',
        lg: 'calc(100vh - 450px)',
    }[app.playerMode.size];
});

const currentTitle = computed(() => client.state.player.current?.video?.title ?? '');
const currentOwner = computed(() => client.state.player.current?.user?.username ?? null);
const watchers = computed(() => client.state.roomConnectedUsers[client.state.currentRoomId] || []);
</script>

<template>
    <div class="group relative w-full flex flex-col">
        <!-- Player content -->
        <div class="pannel-content relative w-full overflow-hidden bg-black">
            <MediaPlayer v-if="showPlayer" class="player w-full h-full" />

            <!-- Hidden but something is playing -->
            <div v-else-if="client.state.player.current" class="w-full py-2 flex items-center justify-center gap-2">
                <div
                    v-if="client.state.player.current.video.thumb"
                    class="w-8 h-8 rounded-md overflow-hidden bg-black flex justify-center"
                    :title="currentTitle"
                >
                    <img :src="client.state.player.current.video.thumb" class="h-full object-cover" />
                </div>
                <span class="text-sm text-white/80">{{ currentTitle }}</span>
            </div>

            <!-- Top overlay -->
            <div
                v-if="showPlayer"
                class="absolute top-0 left-0 right-0 p-3 flex items-start gap-3 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition"
                :style="{ background: 'linear-gradient(to bottom, rgba(0,0,0,.55), transparent)' }"
            >
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate text-white">{{ currentTitle }}</div>
                    <div v-if="currentOwner" class="font-mono text-xs text-white/50 truncate">
                        added by <span class="text-primary">@{{ currentOwner }}</span>
                    </div>
                </div>
                <div class="flex items-center gap-1 shrink-0 pointer-events-auto">
                    <button
                        title="Synchronize player"
                        class="w-8 h-8 rounded-md flex items-center justify-center bg-black/30 hover:bg-black/50 text-white/80 text-sm"
                        @click="client.sendMessage('/playersync')"
                    >
                        <fa icon="rotate" />
                    </button>
                    <button
                        v-if="app.playerMode.size !== 'xs'"
                        title="Shrink player"
                        class="w-8 h-8 rounded-md flex items-center justify-center bg-black/30 hover:bg-black/50 text-white/80 text-sm"
                        @click="app.shrinkPlayer"
                    >
                        <fa icon="compress" />
                    </button>
                    <button
                        v-if="app.playerMode.size !== 'lg'"
                        title="Expand player"
                        class="w-8 h-8 rounded-md flex items-center justify-center bg-black/30 hover:bg-black/50 text-white/80 text-sm"
                        @click="app.expandPlayer"
                    >
                        <fa icon="expand" />
                    </button>
                    <button
                        title="Hide player"
                        class="w-8 h-8 rounded-md flex items-center justify-center bg-black/30 hover:bg-black/50 text-white/80 text-sm"
                        @click="app.setPlayerEnabled(false)"
                    >
                        <fa icon="xmark" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Persistent action strip -->
        <div class="flex items-center gap-2 px-3 py-2 hairline" :style="{ background: 'var(--surface-2)' }">
            <button
                :title="app.playerMode.enabled ? 'Hide player' : 'Show player'"
                class="px-2 py-1 text-sm rounded-md bg-white/5 hairline hover:bg-white/10 text-white/80"
                @click="app.setPlayerEnabled(!app.playerMode.enabled)"
            >
                <fa :icon="app.playerMode.enabled ? 'toggle-on' : 'toggle-off'" />
            </button>

            <button
                v-if="showPlayer"
                title="Replay 30s"
                class="px-2 py-1 text-sm rounded-md bg-white/5 hairline hover:bg-white/10 text-white/80"
                @click="client.sendMessage('/player replay30')"
            >
                <fa icon="caret-left" />
                <fa icon="caret-left" class="-ml-1 mr-1" />
                <span>30s</span>
            </button>
            <button
                v-if="showPlayer"
                title="Skip 30s"
                class="px-2 py-1 text-sm rounded-md bg-white/5 hairline hover:bg-white/10 text-white/80"
                @click="client.sendMessage('/player skip30')"
            >
                <span>30s</span>
                <fa icon="caret-right" class="ml-1" />
                <fa icon="caret-right" class="-ml-1" />
            </button>
            <button
                v-if="showPlayer"
                title="Skip current"
                class="px-2 py-1 text-sm rounded-md bg-white/5 hairline hover:bg-white/10 text-white/80"
                @click="client.sendMessage('/player skip')"
            >
                <fa icon="forward-step" class="mr-1" />
                Skip
            </button>
            <button
                title="Add a video"
                class="px-2 py-1 text-sm rounded-md bg-white/5 hairline hover:bg-white/10 text-white/80"
                @click="app.toggleModal('youtubeVideoSearcher')"
            >
                <fa icon="plus" class="mr-1" />
                Add
            </button>
            <button
                title="Open queue"
                class="px-2 py-1 text-sm rounded-md bg-white/5 hairline hover:bg-white/10 text-white/80"
                :class="{ 'opacity-40 cursor-not-allowed': !client.state.player.queue.length }"
                :disabled="!client.state.player.queue.length"
                @click="app.toggleModal('playerQueue')"
            >
                <fa icon="list" class="mr-1" />
                Queue<span v-if="client.state.player.queue.length"> ({{ client.state.player.queue.length }})</span>
            </button>

            <!-- Sync-watching pill -->
            <div
                v-if="watchers.length > 0 && showPlayer"
                class="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 ring-1 ring-primary/30 text-primary text-sm"
                :title="`${watchers.length} watching`"
            >
                <fa icon="circle-play" />
                <div class="flex -space-x-1.5">
                    <UserMiniAvatarCollection :users="watchers.slice(0, 4)" />
                </div>
                <span class="font-mono">{{ watchers.length }} watching</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pannel-content {
    height: v-bind(playerHeightCss);
}
</style>
