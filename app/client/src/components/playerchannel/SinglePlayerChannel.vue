<script setup>
import SkyTooltip from '@/components/common/SkyTooltip.vue';
import UserMiniAvatarCollection from '@/components/user/UserMiniAvatarCollection.vue';
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

const users = computed(() => {
    return client.state.playerChannelUsers[props.playerChannel.id] || [];
});

const isCurrent = computed(() => client.state.currentPlayerChannelId === props.playerChannel.id);

const currentTitle = computed(() => props.playerChannel.currentMedia?.title ?? props.playerChannel.name);

const currentOwner = computed(() => props.playerChannel.currentMedia?.owner ?? null);

// Activity state. `playing` from the server is true whenever a media is loaded (even paused),
// so split it out: actively playing vs paused vs only-something-queued vs empty.
const isPlaying = computed(() => props.playerChannel.playing && !props.playerChannel.paused);
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

const onClick = () => {
    client.sendMessage(`/playerchannel ${isCurrent.value ? 'leave' : 'join'} ${props.playerChannel.id}`);
};
</script>

<template>
    <!-- Compact (icon-only rail) -->
    <SkyTooltip v-if="compact" as-child side="right" :side-offset="12" class="block">
        <template #trigger>
            <button
                class="relative w-full flex items-center justify-center py-2 rounded-lg cursor-pointer transition"
                :class="
                    isCurrent ? 'bg-primary/15 ring-1 ring-primary/40 hover:bg-primary/20' : 'bg-white/[.03] hairline hover:bg-white/[.06]'
                "
                @click="onClick"
            >
                <div v-if="isCurrent" class="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-primary" />
                <div class="w-7 h-7 rounded flex items-center justify-center transition-colors" :class="iconClass">
                    <fa icon="music" />
                </div>
            </button>
        </template>
        {{ currentOwner ? `${currentTitle} — added by ${currentOwner}` : currentTitle }}
    </SkyTooltip>

    <!-- Full (default) -->
    <button
        v-else
        class="relative w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition cursor-pointer"
        :class="isCurrent ? 'bg-primary/15 ring-1 ring-primary/40 hover:bg-primary/20' : 'bg-white/[.03] hairline hover:bg-white/[.06]'"
        :title="currentOwner ? `${currentTitle} — added by ${currentOwner}` : currentTitle"
        @click="onClick"
    >
        <div v-if="isCurrent" class="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-primary" />
        <div class="w-7 h-7 rounded shrink-0 flex items-center justify-center transition-colors" :class="iconClass">
            <fa icon="music" />
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-sm truncate" :class="hasContent ? '' : 'text-white/50'">{{ currentTitle }}</div>
            <div class="font-mono text-xs text-white/40 truncate">
                {{ statusText }}
                <template v-if="currentOwner"> · {{ currentOwner }}</template>
            </div>
        </div>
        <div v-if="users.length > 0" class="flex -space-x-1.5 shrink-0">
            <UserMiniAvatarCollection :users="users" />
        </div>
        <!-- Animated equalizer: only while actually playing -->
        <div v-else-if="isPlaying" class="flex gap-[2px] items-end h-3.5 shrink-0" aria-hidden="true">
            <span
                v-for="i in 4"
                :key="i"
                class="eq-bar w-[2px] h-full bg-rose-400 rounded-full"
                :style="{ animationDelay: (i - 1) * 150 + 'ms' }"
            />
        </div>
    </button>
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

@media (prefers-reduced-motion: reduce) {
    .eq-bar,
    .now-playing {
        animation: none;
    }
}
</style>
