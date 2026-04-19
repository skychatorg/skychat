<script setup>
import SinglePlayerChannel from '@/components/playerchannel/SinglePlayerChannel.vue';
import { useClientStore } from '@/stores/client';

const client = useClientStore();
</script>

<template>
    <div v-if="client.state.playerChannels.length" class="p-3 pt-2 hairline" :style="{ background: 'var(--surface-2)' }">
        <div class="flex items-center justify-between px-1 mb-2">
            <span class="text-xs font-mono uppercase tracking-wider text-white/30">Media channel</span>
            <fa icon="wave-square" class="text-primary" />
        </div>
        <div class="flex flex-col gap-1">
            <SinglePlayerChannel
                v-for="playerChannel in client.state.playerChannels"
                :key="playerChannel.id"
                :player-channel="playerChannel"
            />
        </div>
    </div>
</template>
