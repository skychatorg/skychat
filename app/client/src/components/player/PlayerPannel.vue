<script setup>
import MediaPlayer from '@/components/player/MediaPlayer.vue';
import PlayerSeekBar from '@/components/player/PlayerSeekBar.vue';
import UserMiniAvatarCollection from '@/components/user/UserMiniAvatarCollection.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import JellyfinTrackPicker from '@/components/player/impl/JellyfinTrackPicker.vue';
import SkyDropdown from '@/components/common/SkyDropdown.vue';
import SkyDropdownItem from '@/components/common/SkyDropdownItem.vue';
import { useJellyfinTracks } from '@/composables/useJellyfinTracks.js';
import { isPausable } from '@/lib/player';
import { computed, onUnmounted, ref } from 'vue';

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
        md: '40vh',
        lg: 'calc(100vh - 475px)',
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
// Watchers are the users in the current player channel (not the chat room — the two are
// independent). Read from the live `playerChannels` array rather than the cached
// `currentPlayerChannel` reference, which can go stale after a channel-list update.
const watchers = computed(() => {
    const channel = client.state.playerChannels.find((c) => c.id === client.state.currentPlayerChannelId);
    return channel?.users ?? [];
});
const pausable = computed(() => isPausable(client.state.player.current?.video));
const togglePause = () => client.sendMessage(client.state.player.paused ? '/player resume' : '/player pause');

// Countdown resync. The server sends the absolute instant everyone resumes at; we just tick towards
// it locally, so latency cannot skew what each viewer sees.
const now = ref(Date.now());
const nowTimer = setInterval(() => (now.value = Date.now()), 250);
onUnmounted(() => clearInterval(nowTimer));

const resyncSecondsLeft = computed(() => {
    const at = client.state.player.resyncAt;
    if (!at) {
        return null;
    }
    const left = Math.ceil((at - now.value) / 1000);
    return left > 0 ? left : null;
});
const resyncing = computed(() => resyncSecondsLeft.value !== null);
const { preferredAudioLang, preferredSubLang, jellyfin } = useJellyfinTracks();

const resyncEveryone = () => client.sendMessage('/playersync all');
const syncSelf = () => client.sendMessage('/playersync');
</script>

<template>
    <div class="strip-host group relative w-full flex flex-col">
        <!-- Player content -->
        <div class="pannel-content relative w-full overflow-hidden bg-black">
            <MediaPlayer v-if="showPlayer" class="player w-full h-full" />

            <!-- Hidden but something is playing -->
            <div v-else-if="client.state.player.current" class="w-full py-2 flex items-center justify-center gap-2">
                <div v-if="currentThumb" class="w-8 h-8 rounded-md overflow-hidden bg-black flex justify-center" :title="currentTitle">
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
            </div>

            <!-- Countdown resync. Transient and click-through, so it never blocks the embed's own
                 controls the way the old button cluster did. -->
            <div
                v-if="showPlayer && resyncing"
                class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 pointer-events-none bg-black/40"
            >
                <div class="font-mono text-5xl text-white tabular-nums">{{ resyncSecondsLeft }}</div>
                <div class="text-sm text-white/70">Re-synchronizing everyone…</div>
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
                    <span class="ml-0.5 strip-label">30s</span>
                </button>
                <button v-if="pausable" class="strip-btn" :title="client.state.player.paused ? 'Resume' : 'Pause'" @click="togglePause">
                    <fa :icon="client.state.player.paused ? 'play' : 'pause'" />
                </button>
                <button class="strip-btn" title="Skip 30s" @click="client.sendMessage('/player skip30')">
                    <span class="mr-0.5 strip-label">30s</span>
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
                    <span class="strip-label">Add</span>
                </button>
                <button
                    class="strip-btn"
                    title="Open queue"
                    :disabled="!client.state.player.queue.length"
                    @click="app.toggleModal('playerQueue')"
                >
                    <fa icon="list" />
                    <span class="strip-label">Queue</span>
                    <span
                        v-if="client.state.player.queue.length"
                        class="ml-0.5 px-1.5 rounded-full bg-primary/20 text-primary text-xs font-mono"
                    >
                        {{ client.state.player.queue.length }}
                    </span>
                </button>
            </div>

            <!-- Audio / subtitles (Jellyfin only) -->
            <JellyfinTrackPicker
                v-if="showPlayer && jellyfin"
                v-model:audio="preferredAudioLang"
                v-model:sub="preferredSubLang"
                :audio-tracks="jellyfin.audioTracks"
                :subtitle-tracks="jellyfin.subtitleTracks"
            />

            <!-- Re-sync everyone -->
            <div v-if="showPlayer" class="strip-group hairline ml-auto">
                <button
                    class="strip-btn"
                    :title="
                        resyncing
                            ? 'Re-synchronizing everyone…'
                            : 'Re-synchronize everyone: pauses the channel, counts down so everyone can buffer, then resumes together'
                    "
                    :disabled="resyncing"
                    @click="resyncEveryone"
                >
                    <fa icon="rotate" :class="resyncing ? 'animate-spin' : ''" />
                    <span class="strip-label">{{ resyncing ? resyncSecondsLeft : 'Re-sync' }}</span>
                </button>
            </div>

            <!-- Sync-watching pill -->
            <div
                v-if="watchers.length > 0 && showPlayer"
                class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 ring-1 ring-primary/30 text-primary text-sm"
                :title="`${watchers.length} watching`"
            >
                <fa icon="circle-play" />
                <div class="strip-label -space-x-1.5">
                    <UserMiniAvatarCollection :users="watchers.slice(0, 4)" />
                </div>
                <span class="font-mono">{{ watchers.length }}</span>
                <span class="strip-label">watching</span>
            </div>

            <!-- Player size. These used to float over the video, where they covered the embed's own
                 controls (YouTube's quality/subtitle gear, its fullscreen button). -->
            <div v-if="showPlayer" class="strip-group hairline">
                <button class="strip-btn" title="Shrink player" :disabled="app.playerMode.size === 'xs'" @click="app.shrinkPlayer">
                    <fa icon="compress" />
                </button>
                <button class="strip-btn" title="Expand player" :disabled="app.playerMode.size === 'lg'" @click="app.expandPlayer">
                    <fa icon="expand" />
                </button>
            </div>

            <!-- Overflow: the least-used controls live here so the strip stays a single row -->
            <div class="strip-group hairline">
                <SkyDropdown>
                    <template #trigger>
                        <span class="strip-btn" title="More player options">
                            <fa icon="ellipsis" />
                        </span>
                    </template>
                    <template #default>
                        <SkyDropdownItem v-if="showPlayer" @click="syncSelf">
                            <fa icon="rotate" class="w-4 mr-2" />
                            Sync just me
                        </SkyDropdownItem>
                        <SkyDropdownItem @click="app.setPlayerEnabled(false)">
                            <fa icon="xmark" class="w-4 mr-2" />
                            Hide player
                        </SkyDropdownItem>
                    </template>
                </SkyDropdown>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pannel-content {
    height: v-bind(playerHeightCss);
}
</style>
