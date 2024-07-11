<script setup>
import SingleRoom from '@/components/room/SingleRoom.vue';
import SectionTitle from '@/components/util/SectionTitle.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const app = useAppStore();
const client = useClientStore();

const hasUnread = computed(() => {
    return client.hasUnreadMessages();
});

function manageRooms() {
    app.toggleModal('manageRooms');
}
</script>

<template>
    <div class="flex flex-col">
        <SectionTitle
            :class="{
                '!text-red-400': hasUnread,
            }"
        >
            Rooms
            <fa v-if="hasUnread" icon="comments" />
            <a v-if="client.state.op" class="ml-auto cursor-pointer" @click="manageRooms">
                <fa icon="gear" />
            </a>
        </SectionTitle>
        <div class="px-2 h-0 grow overflow-y-auto scrollbar">
            <SingleRoom v-for="room in client.state.rooms" :key="room.id" :room="room" />
        </div>
    </div>
</template>
