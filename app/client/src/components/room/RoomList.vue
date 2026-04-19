<script setup>
import SingleRoom from '@/components/room/SingleRoom.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed, ref, watch } from 'vue';

const app = useAppStore();
const client = useClientStore();

// Manage unread messages
const hasUnread = ref(client.hasUnreadMessages());
const updateHandler = () => {
    hasUnread.value = client.hasUnreadMessages();
};
watch(() => client.state, updateHandler, { deep: true });

const publicRooms = computed(() => (client.state.rooms || []).filter((r) => !r.isPrivate));
const directRooms = computed(() => (client.state.rooms || []).filter((r) => r.isPrivate));

function manageRooms() {
    app.toggleModal('manageRooms');
}
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <!-- Public rooms -->
        <div class="p-3 pb-2 shrink-0">
            <div class="flex items-center justify-between px-2 mb-1">
                <span class="text-xs font-mono uppercase tracking-wider text-white/30">
                    Rooms
                    <fa v-if="hasUnread" icon="comments" class="ml-1 text-danger" />
                </span>
                <button v-if="client.state.op" title="Manage rooms" class="text-xs text-white/40 hover:text-white/80" @click="manageRooms">
                    <fa icon="gear" />
                </button>
            </div>
            <div class="flex flex-col">
                <SingleRoom v-for="room in publicRooms" :key="room.id" :room="room" />
            </div>
        </div>

        <!-- Direct messages -->
        <div class="px-3 pb-2 flex-1 min-h-0 overflow-y-auto scrollbar">
            <div class="flex items-center justify-between px-2 my-1">
                <span class="text-xs font-mono uppercase tracking-wider text-white/30">Direct</span>
            </div>
            <div class="flex flex-col">
                <SingleRoom v-for="room in directRooms" :key="room.id" :room="room" />
            </div>
        </div>
    </div>
</template>
