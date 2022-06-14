<script setup>
import { useClientStore } from '@/stores/client';
import SingleRoom from '@/components/room/SingleRoom.vue';

const client = useClientStore();
</script>

<template>
    <div>
        <p class=" pl-6 mb-1 font-bold text-skygray-casual">Rooms</p>
        <div class="px-2">
            <SingleRoom
                v-for="room in client.state.rooms"
                :key="room.id"
                :room="room"
            />
        </div>
    </div>
</template>

<style scoped>

</style>
