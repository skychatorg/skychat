<script setup>
import { computed } from 'vue';
import { useClientStore } from '@/stores/client';
import { formatMs } from '@/lib/formatTime';
import { mediaThumbUrl } from '@/lib/player';

const client = useClientStore();

// Per-source presentation. Falls back to a generic film icon for unknown types.
const SOURCES = {
    youtube: { icon: 'video', label: 'YouTube' },
    twitch: { icon: 'tv', label: 'Twitch' },
    jellyfin: { icon: 'film', label: 'Jellyfin' },
    navidrome: { icon: 'music', label: 'Music' },
    gallery: { icon: 'image', label: 'Gallery' },
    iframe: { icon: 'globe', label: 'Web' },
};
const source = (video) => SOURCES[video.type] ?? { icon: 'film', label: video.type };

const current = computed(() => client.state.player.current);
const queue = computed(() => client.state.player.queue);
const totalDuration = computed(() => queue.value.reduce((sum, entry) => sum + (entry.video.duration || 0), 0));

const canManage = (entry) => client.state.op || entry.user.id === client.state.user.id;
const thumbUrl = (video) => mediaThumbUrl(video, client.state.player.streamToken);

const remove = (video) => client.sendMessage(`/playerremovevideo ${video.type} ${video.id}`);
const clearQueue = () => client.sendMessage('/player flush');
</script>

<template>
    <div class="flex flex-col gap-3 min-h-0">
        <!-- Now playing -->
        <div v-if="current" class="now-playing flex gap-3 p-2 rounded-lg">
            <div class="thumb shrink-0">
                <img v-if="thumbUrl(current.video)" :src="thumbUrl(current.video)" alt="" class="h-full w-full object-cover" />
                <fa v-else :icon="source(current.video).icon" class="text-skygray-light" />
            </div>
            <div class="min-w-0 flex flex-col justify-center">
                <div class="flex items-center gap-1.5 text-primary text-xs font-medium uppercase tracking-wide">
                    <span class="live-dot"></span>
                    Now playing
                </div>
                <div class="text-sm text-skygray-white truncate" :title="current.video.title">{{ current.video.title }}</div>
                <div class="text-xs text-skygray-lighter truncate">
                    <fa :icon="source(current.video).icon" class="mr-1" />{{ source(current.video).label }}
                    <span v-if="current.user"> · @{{ current.user.username }}</span>
                </div>
            </div>
        </div>

        <div class="flex items-center justify-between px-1">
            <div class="text-xs text-skygray-lighter">
                <span class="text-skygray-white font-medium">{{ queue.length }}</span>
                up next
                <span v-if="totalDuration > 0"> · {{ formatMs(totalDuration) }}</span>
            </div>
            <button v-if="client.state.op && queue.length" class="text-xs text-danger hover:underline" @click="clearQueue">
                <fa icon="trash" class="mr-1" />Clear
            </button>
        </div>

        <ol v-if="queue.length" class="flex flex-col gap-1">
            <li
                v-for="(entry, index) in queue"
                :key="`${entry.video.type}-${entry.video.id}-${index}`"
                class="entry flex items-center gap-2 py-1.5 pl-2 pr-1 rounded-lg hairline bg-white/[.02]"
            >
                <div class="text-xs text-skygray-light font-mono w-4 text-right shrink-0">{{ index + 1 }}</div>
                <div class="thumb shrink-0">
                    <img
                        v-if="thumbUrl(entry.video)"
                        :src="thumbUrl(entry.video)"
                        alt=""
                        loading="lazy"
                        class="h-full w-full object-cover"
                    />
                    <fa v-else :icon="source(entry.video).icon" class="text-skygray-light" />
                </div>
                <div class="min-w-0 grow flex flex-col">
                    <div class="text-sm text-skygray-lightest truncate" :title="entry.video.title">{{ entry.video.title }}</div>
                    <div class="flex items-center gap-2 text-xs text-skygray-lighter">
                        <span :title="source(entry.video).label"><fa :icon="source(entry.video).icon" /></span>
                        <span class="truncate">@{{ entry.user.username }}</span>
                        <span v-if="entry.video.duration > 0" class="ml-auto shrink-0 font-mono">{{ formatMs(entry.video.duration) }}</span>
                    </div>
                </div>
                <button
                    v-if="canManage(entry)"
                    class="remove shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-skygray-light hover:text-danger hover:bg-danger/10"
                    title="Remove from the queue"
                    @click="remove(entry.video)"
                >
                    <fa icon="xmark" />
                </button>
            </li>
        </ol>

        <div
            v-else
            class="flex flex-col items-center justify-center text-center py-10 px-4 rounded-lg border border-dashed border-white/10"
        >
            <fa icon="list" class="text-3xl text-skygray-light mb-2" />
            <div class="text-sm text-skygray-lightest">Nothing up next</div>
            <div class="text-xs text-skygray-lighter mt-1">What you add shows up here.</div>
        </div>

        <p v-if="queue.length > 1" class="text-xs text-white/40 px-1">Turns alternate between people, so everyone gets a go.</p>
    </div>
</template>

<style scoped>
.now-playing {
    background: rgb(var(--color-primary) / 0.08);
    box-shadow: inset 0 0 0 1px rgb(var(--color-primary) / 0.2);
}

.thumb {
    width: 4rem;
    aspect-ratio: 16 / 9;
    border-radius: 0.375rem;
    overflow: hidden;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.live-dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 9999px;
    background: rgb(var(--color-primary));
    animation: live-pulse 1.6s ease-in-out infinite;
}
@keyframes live-pulse {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.3;
    }
}

/* Reveal remove on row hover; always visible on touch screens */
.remove {
    opacity: 0;
    transition: opacity 0.15s ease;
}
.entry:hover .remove,
.remove:focus-visible {
    opacity: 1;
}
@media (hover: none) {
    .remove {
        opacity: 1;
    }
}
</style>
