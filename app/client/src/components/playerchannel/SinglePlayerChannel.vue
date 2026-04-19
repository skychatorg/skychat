<script setup>
import UserMiniAvatarCollection from '@/components/user/UserMiniAvatarCollection.vue';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const client = useClientStore();

const props = defineProps({
    playerChannel: {
        type: Object,
        required: true,
    },
});

const users = computed(() => {
    return client.state.playerChannelUsers[props.playerChannel.id] || [];
});

const isCurrent = computed(() => client.state.currentPlayerChannelId === props.playerChannel.id);

const currentTitle = computed(() => props.playerChannel.currentMedia?.title ?? props.playerChannel.name);

const currentOwner = computed(() => props.playerChannel.currentMedia?.owner ?? null);

const onClick = () => {
    client.sendMessage(`/playerchannel ${isCurrent.value ? 'leave' : 'join'} ${props.playerChannel.id}`);
};
</script>

<template>
    <button
        class="relative w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition cursor-pointer"
        :class="isCurrent ? 'bg-primary/15 ring-1 ring-primary/40 hover:bg-primary/20' : 'bg-white/[.03] hairline hover:bg-white/[.06]'"
        :title="currentOwner ? `${currentTitle} — added by ${currentOwner}` : currentTitle"
        @click="onClick"
    >
        <div v-if="isCurrent" class="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-primary" />
        <div
            class="w-7 h-7 rounded shrink-0 flex items-center justify-center"
            :class="isCurrent ? 'bg-gradient-to-br from-primary to-secondary' : 'bg-gradient-to-br from-rose-500 to-fuchsia-600'"
        >
            <fa icon="music" class="text-white" />
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-sm truncate">{{ currentTitle }}</div>
            <div class="font-mono text-xs text-white/40 truncate">
                {{ playerChannel.playing ? 'live' : 'idle' }}
                <template v-if="currentOwner"> · {{ currentOwner }}</template>
            </div>
        </div>
        <div v-if="users.length > 0" class="flex -space-x-1.5 shrink-0">
            <UserMiniAvatarCollection :users="users" />
        </div>
        <div v-else class="flex gap-0.5 items-end h-3 shrink-0" aria-hidden="true">
            <span
                v-for="(h, i) in [3, 5, 2, 6, 4]"
                :key="i"
                class="w-[2px] bg-primary"
                :style="{ height: h * 2 + 'px', opacity: 0.5 + i * 0.1 }"
            />
        </div>
    </button>
</template>
