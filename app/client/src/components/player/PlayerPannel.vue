<script setup>
import MediaPlayer from '@/components/player/MediaPlayer.vue';
import PlayerSeekBar from '@/components/player/PlayerSeekBar.vue';
import UserMiniAvatarCollection from '@/components/user/UserMiniAvatarCollection.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { isPausable } from '@/lib/player';
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
// Jellyfin thumbnails are served through the authenticated proxy, so they need the per-viewer
// stream token appended. Other video types expose absolute thumb URLs and pass through unchanged.
const currentThumb = computed(() => {
    const video = client.state.player.current?.video;
    if (!video?.thumb) {
        return null;
    }
    if (video.type === 'jellyfin') {
        const token = client.state.player.streamToken;
        if (!token) {
            return null;
        }
        return `${video.thumb}&t=${encodeURIComponent(token)}`;
    }
    return video.thumb;
});
const currentOwner = computed(() => client.state.player.current?.user?.username ?? null);
const watchers = computed(() => client.state.roomConnectedUsers[client.state.currentRoomId] || []);
const pausable = computed(() => isPausable(client.state.player.current?.video));
const togglePause = () => client.sendMessage(client.state.player.paused ? '/player resume' : '/player pause');
</script>

<template>
    <div class="group relative w-full flex flex-col">
        <!-- Player content -->
        <div class="pannel-content relative w-full overflow-hidden bg-black">
            <MediaPlayer v-if="showPlayer" class="player w-full h-full" />

            <!-- Hidden but something is playing -->
            <div v-else-if="client.state.player.current" class="w-full py-2 flex items-center justify-center gap-2">
                <div
                    v-if="currentThumb"
                    class="w-8 h-8 rounded-md overflow-hidden bg-black flex justify-center"
                    :title="currentTitle"
                >
                    <img :src="currentThumb" class="h-full object-cover" />
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

        <!-- Seek bar (only for media with a known duration) -->
        <PlayerSeekBar v-if="showPlayer" />

        <!-- Persistent action strip -->
        <div class="strip px-3 py-2 hairline" :style="{ background: 'var(--surface-2)' }">
            <!-- Visibility -->
            <div class="strip-group hairline">
                <button
                    class="strip-btn"
                    :title="app.playerMode.enabled ? 'Hide player' : 'Show player'"
                    @click="app.setPlayerEnabled(!app.playerMode.enabled)"
                >
                    <fa :icon="app.playerMode.enabled ? 'toggle-on' : 'toggle-off'" />
                </button>
            </div>

            <!-- Transport (only while the player is shown) -->
            <div v-if="showPlayer" class="strip-group hairline">
                <button class="strip-btn" title="Replay 30s" @click="client.sendMessage('/player replay30')">
                    <fa icon="caret-left" />
                    <fa icon="caret-left" class="-ml-1" />
                    <span class="ml-0.5 hidden sm:inline">30s</span>
                </button>
                <button v-if="pausable" class="strip-btn" :title="client.state.player.paused ? 'Resume' : 'Pause'" @click="togglePause">
                    <fa :icon="client.state.player.paused ? 'play' : 'pause'" />
                </button>
                <button class="strip-btn" title="Skip 30s" @click="client.sendMessage('/player skip30')">
                    <span class="mr-0.5 hidden sm:inline">30s</span>
                    <fa icon="caret-right" />
                    <fa icon="caret-right" class="-ml-1" />
                </button>
                <button class="strip-btn" title="Skip to next" @click="client.sendMessage('/player skip')">
                    <fa icon="forward-step" />
                </button>
            </div>

            <!-- Library -->
            <div class="strip-group hairline">
                <button class="strip-btn" title="Add a video" @click="app.toggleModal('youtubeVideoSearcher')">
                    <fa icon="plus" />
                    <span class="hidden sm:inline">Add</span>
                </button>
                <button
                    class="strip-btn"
                    title="Open queue"
                    :disabled="!client.state.player.queue.length"
                    @click="app.toggleModal('playerQueue')"
                >
                    <fa icon="list" />
                    <span class="hidden sm:inline">Queue</span>
                    <span
                        v-if="client.state.player.queue.length"
                        class="ml-0.5 px-1.5 rounded-full bg-primary/20 text-primary text-xs font-mono"
                    >
                        {{ client.state.player.queue.length }}
                    </span>
                </button>
            </div>

            <!-- Sync-watching pill -->
            <div
                v-if="watchers.length > 0 && showPlayer"
                class="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 ring-1 ring-primary/30 text-primary text-sm"
                :title="`${watchers.length} watching`"
            >
                <fa icon="circle-play" />
                <div class="hidden sm:flex -space-x-1.5">
                    <UserMiniAvatarCollection :users="watchers.slice(0, 4)" />
                </div>
                <span class="font-mono">{{ watchers.length }}</span>
                <span class="hidden sm:inline">watching</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pannel-content {
    height: v-bind(playerHeightCss);
}

/* Action strip: a single non-wrapping row of segmented control clusters. */
.strip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: nowrap;
}

/* A cluster of related buttons rendered as one connected segmented control. */
.strip-group {
    display: inline-flex;
    align-items: center;
    border-radius: 0.375rem;
    background: rgba(255, 255, 255, 0.05);
    overflow: hidden;
}

.strip-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: rgba(255, 255, 255, 0.8);
    white-space: nowrap;
    transition:
        background 0.15s ease,
        color 0.15s ease;
}

/* Divider line between buttons within a cluster. */
.strip-btn + .strip-btn {
    box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.07);
}

.strip-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.strip-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
</style>
