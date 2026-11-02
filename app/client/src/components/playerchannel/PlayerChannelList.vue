<script setup>
import SinglePlayerChannel from '@/components/playerchannel/SinglePlayerChannel.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';

const app = useAppStore();
const client = useClientStore();

defineProps({
    compact: {
        type: Boolean,
        default: false,
    },
});
</script>

<template>
    <div
        v-if="client.state.playerChannels.length || client.state.op"
        class="hairline"
        :class="compact ? 'p-1 py-2' : 'p-3 pt-2'"
        :style="{ background: 'var(--surface-2)' }"
    >
        <div v-if="!compact" class="flex items-center justify-between px-1 mb-2">
            <span class="text-xs font-mono uppercase tracking-wider text-white/30">Channels</span>
            <button
                v-if="client.state.op"
                title="Manage channels"
                class="text-xs text-white/40 hover:text-white/80"
                @click="app.toggleModal('manageChannels')"
            >
                <fa icon="gear" />
            </button>
            <fa v-else icon="wave-square" class="text-primary" />
        </div>
        <div class="flex flex-col gap-1">
            <SinglePlayerChannel
                v-for="playerChannel in client.state.playerChannels"
                :key="playerChannel.id"
                :player-channel="playerChannel"
                :compact="compact"
            />
        </div>
    </div>
</template>
