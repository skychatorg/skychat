<script setup>
import SkyTooltip from '@/components/common/SkyTooltip.vue';
import UserMiniAvatarCollection from '@/components/user/UserMiniAvatarCollection.vue';
import { channelIcon, PARTY_GAMES } from '@/lib/channel';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const client = useClientStore();

const props = defineProps({
    playerChannel: {
        type: Object,
        required: true,
    },
    compact: {
        type: Boolean,
        default: false,
    },
});

// Channel-provided list (built server-side from live sessions), so guests are included.
const users = computed(() => props.playerChannel.users ?? []);

const isCurrent = computed(() => client.state.currentPlayerChannelId === props.playerChannel.id);
// Joined too, playing beside the player: music while you play a game
const isSide = computed(() => client.state.sideChannelId === props.playerChannel.id);

const currentTitle = computed(() => props.playerChannel.currentMedia?.title ?? props.playerChannel.name);

const currentOwner = computed(() => props.playerChannel.currentMedia?.owner ?? null);

// Activity state. `playing` from the server is true whenever a media is loaded (even paused),
// so split it out: actively playing vs paused vs only-something-queued vs empty.
const party = computed(() => props.playerChannel.party);
// A party is "live" while a game is on
const isPlaying = computed(() => (party.value ? Boolean(party.value.game) : props.playerChannel.playing && !props.playerChannel.paused));
const isPaused = computed(() => Boolean(props.playerChannel.paused));
const hasQueue = computed(() => (props.playerChannel.queueLength ?? 0) > 0);
// "Something is going on here" — loaded media (playing or paused) or a non-empty queue.
const hasContent = computed(() => props.playerChannel.playing || hasQueue.value);

// Icon look by activity: vivid + glow when playing, dimmed when paused/queued, gray when empty.
const iconClass = computed(() => {
    if (isPlaying.value) {
        return 'bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white now-playing';
    }
    if (hasContent.value) {
        return 'bg-gradient-to-br from-rose-500/30 to-fuchsia-600/30 text-white/70';
    }
    return 'bg-white/[.05] text-white/30';
});

const statusText = computed(() => {
    if (party.value) {
        const { game, seated } = party.value;
        if (!game) {
            return 'lobby';
        }
        return PARTY_GAMES[game].name + (seated ? ` · ${seated} playing` : '');
    }
    if (isPlaying.value) {
        return 'live';
    }
    if (isPaused.value) {
        return 'paused';
    }
    if (hasQueue.value) {
        return `${props.playerChannel.queueLength} queued`;
    }
    return 'idle';
});

// Clicking never leaves: the channel in the player stays, the one beside it swaps in, others are joined
const onClick = () => {
    if (isSide.value) {
        client.swapPlayerChannels();
    } else if (!isCurrent.value) {
        client.sendMessage(`/playerchannel join ${props.playerChannel.id}`);
    }
};
const leave = () => client.sendMessage(`/playerchannel leave ${props.playerChannel.id}`);
</script>

<template>
    <!-- Compact (icon-only rail) -->
    <SkyTooltip v-if="compact" as-child side="right" :side-offset="12" class="block">
        <template #trigger>
            <button
                class="relative w-full flex items-center justify-center py-2 rounded-lg cursor-pointer transition"
                :class="[
                    isCurrent
                        ? 'bg-primary/15 ring-1 ring-primary/40 hover:bg-primary/20'
                        : isSide
                        ? 'bg-primary/[.06] ring-1 ring-primary/20 hover:bg-primary/10'
                        : 'bg-white/[.03] hairline hover:bg-white/[.06]',
                    isPlaying ? 'live-sweep live-sweep-media' : '',
                ]"
                @click="onClick"
            >
                <div v-if="isCurrent" class="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-primary" />
                <div class="w-7 h-7 rounded flex items-center justify-center transition-colors" :class="iconClass">
                    <fa :icon="channelIcon(playerChannel)" />
                </div>
            </button>
        </template>
        {{ currentOwner ? `${currentTitle} — added by ${currentOwner}` : currentTitle }}
    </SkyTooltip>

    <!-- Full (default) -->
    <div v-else class="relative group">
        <button
            class="relative w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition cursor-pointer"
            :class="[
                isCurrent
                    ? 'bg-primary/15 ring-1 ring-primary/40 hover:bg-primary/20'
                    : isSide
                    ? 'bg-primary/[.06] ring-1 ring-primary/20 hover:bg-primary/10'
                    : 'bg-white/[.03] hairline hover:bg-white/[.06]',
                isPlaying ? 'live-sweep live-sweep-media' : '',
            ]"
            :title="currentOwner ? `${currentTitle} — added by ${currentOwner}` : currentTitle"
            @click="onClick"
        >
            <div v-if="isCurrent" class="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-primary" />
            <div class="w-7 h-7 rounded shrink-0 flex items-center justify-center transition-colors" :class="iconClass">
                <fa :icon="channelIcon(playerChannel)" />
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm truncate" :class="hasContent ? '' : 'text-white/50'">{{ currentTitle }}</div>
                <div class="font-mono text-xs text-white/40 truncate">
                    <template v-if="isSide">on the side · </template>
                    {{ statusText }}
                    <template v-if="currentOwner"> · {{ currentOwner }}</template>
                </div>
            </div>
            <div v-if="users.length > 0" class="trail flex -space-x-1.5 shrink-0">
                <UserMiniAvatarCollection :users="users" />
            </div>
            <!-- Animated equalizer: only while actually playing -->
            <div v-else-if="isPlaying" class="trail flex gap-[2px] items-end h-3.5 shrink-0" aria-hidden="true">
                <span
                    v-for="i in 4"
                    :key="i"
                    class="eq-bar w-[2px] h-full bg-rose-400 rounded-full"
                    :style="{ animationDelay: (i - 1) * 150 + 'ms' }"
                />
            </div>
        </button>
        <!-- Leaving is its own button, so a click on the channel never drops you out of it -->
        <button
            v-if="isCurrent || isSide"
            class="leave absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-[var(--surface-2)] ring-1 ring-white/15 text-white/80 hover:text-white hover:bg-white/10"
            :title="`Leave ${playerChannel.name}`"
            :aria-label="`Leave ${playerChannel.name}`"
            @click="leave"
        >
            <fa icon="arrow-right-from-bracket" />
            <span>Leave</span>
        </button>
    </div>
</template>

<style scoped>
/* Music visualizer bars bouncing while a media plays */
@keyframes eq {
    0%,
    100% {
        transform: scaleY(0.25);
    }
    50% {
        transform: scaleY(1);
    }
}
.eq-bar {
    transform-origin: bottom;
    animation: eq 0.9s ease-in-out infinite;
}

/* Soft glow pulse on the icon while playing */
@keyframes nowPlayingGlow {
    0%,
    100% {
        box-shadow: 0 0 0 0 rgba(244, 63, 94, 0);
    }
    50% {
        box-shadow: 0 0 10px 1px rgba(244, 63, 94, 0.55);
    }
}
.now-playing {
    animation: nowPlayingGlow 2s ease-in-out infinite;
}

/* Shown on hover, always on touch screens where there is no hover */
.leave {
    opacity: 0;
    transition: opacity 0.15s;
}
.group:hover .leave,
.leave:focus-visible {
    opacity: 1;
}
/* The Leave button takes the place of the avatars instead of covering them */
.group:has(.leave):hover .trail {
    visibility: hidden;
}
@media (hover: none) {
    .leave {
        opacity: 1;
    }
    .group:has(.leave) .trail {
        visibility: hidden;
    }
}

@media (prefers-reduced-motion: reduce) {
    .eq-bar,
    .now-playing {
        animation: none;
    }
}
</style>
