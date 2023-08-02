<script setup>
import { useClientStore } from '@/stores/client';
import SingleRoom from '@/components/room/SingleRoom.vue';
import SectionTitle from '@/components/util/SectionTitle.vue';

const client = useClientStore();
</script>

<template>
    <div>
        <SectionTitle>Rooms</SectionTitle>
        <div class="px-2">
            <SingleRoom v-for="room in client.state.rooms" :key="room.id" :room="room" />
        </div>
    </div>
</template>

<style scoped></style>
