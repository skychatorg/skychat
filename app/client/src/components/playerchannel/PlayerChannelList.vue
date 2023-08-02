<script setup>
import { useClientStore } from '@/stores/client';
import SinglePlayerChannel from '@/components/playerchannel/SinglePlayerChannel.vue';
import SectionTitle from '@/components/util/SectionTitle.vue';

const client = useClientStore();
</script>

<template>
    <div>
        <SectionTitle v-if="client.state.playerChannels.length"> Media channels </SectionTitle>
        <div class="px-2">
            <SinglePlayerChannel v-for="playerChannel in client.state.playerChannels" :key="playerChannel.id" :player-channel="playerChannel" />
        </div>
    </div>
</template>
