<script setup>
import { useClientStore } from '@/stores/client';
import SinglePlayerChannel from '@/components/playerchannel/SinglePlayerChannel.vue';

const client = useClientStore();
</script>

<template>
    <div>
        <h2 class=" pl-4 font-bold text-skygray-casual">Media channels</h2>
        <div class="px-2">
            <SinglePlayerChannel
                v-for="playerChannel in client.state.playerChannels"
                :key="playerChannel.id"
                :player-channel="playerChannel"
            />
        </div>
    </div>
</template>

<style scoped>

</style>
