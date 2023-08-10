<script setup>
import { computed } from 'vue';
import { useClientStore } from '@/stores/client';
import SingleRoom from '@/components/room/SingleRoom.vue';
import SectionTitle from '@/components/util/SectionTitle.vue';

const client = useClientStore();

// Whether has unread
const hasUnread = computed(() => {
    if (client.state.user.id === 0) {
        return false;
    }

    // Check last seen message in this room vs last received message in this room
    for (const room of client.state.rooms) {
        if (room.lastReceivedMessageId > (client.state.user.data.plugins.lastseen[room.id] ?? 0)) {
            return true;
        }
    }

    return false;
});
</script>

<template>
    <div class="flex flex-col">
        <SectionTitle
            :class="{
                'text-red-400': hasUnread,
            }"
        >
            Rooms
            <fa v-if="hasUnread" icon="comments" />
        </SectionTitle>
        <div class="px-2 h-0 grow overflow-y-auto scrollbar">
            <SingleRoom v-for="room in client.state.rooms" :key="room.id" :room="room" />
        </div>
    </div>
</template>
