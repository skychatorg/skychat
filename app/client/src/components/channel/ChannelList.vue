<script setup>
import { useClientStore } from '@/stores/client';
import SingleChannel from '@/components/channel/SingleChannel.vue';

const client = useClientStore();
</script>

<template>
    <div>

        <p class="hidden pl-6 mb-1 font-bold text-skygray-casual">Text channels</p>
        <div class="px-2">
            <SingleChannel
                v-for="room in client.state.rooms"
                :key="room.id"
                :room="room"
            />
        </div>
    </div>
</template>

<style scoped>

</style>
