<script setup>
import SingleRoom from '@/components/room/SingleRoom.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed, ref, watch } from 'vue';

const app = useAppStore();
const client = useClientStore();

defineProps({
    compact: {
        type: Boolean,
        default: false,
    },
});

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
        <!-- Collapse toggle (desktop only, pinned above the scroll area) -->
        <div v-if="compact" class="hidden lg:flex shrink-0 px-1 pt-3">
            <button
                class="w-full flex items-center justify-center py-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition"
                title="Expand sidebar"
                @click="app.toggleLeftCollapsed()"
            >
                <span class="w-4 text-center text-xs">
                    <fa icon="chevron-right" />
                </span>
            </button>
        </div>
        <div v-else class="hidden lg:flex shrink-0 items-center justify-end px-3 pt-3">
            <button
                class="w-7 h-7 rounded text-white/40 hover:text-white hover:bg-white/5 transition flex items-center justify-center"
                title="Collapse sidebar"
                @click="app.toggleLeftCollapsed()"
            >
                <fa icon="chevron-left" class="text-xs" />
            </button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto scrollbar">
            <!-- Public rooms -->
            <div :class="compact ? 'px-1 pt-2 pb-2' : 'p-3 pt-2 pb-2'">
                <div v-if="!compact" class="flex items-center justify-between px-2 mb-1">
                    <span class="text-xs font-mono uppercase tracking-wider text-white/30">
                        Rooms
                        <fa v-if="hasUnread" icon="comments" class="ml-1 text-danger" />
                    </span>
                    <button
                        v-if="client.state.op"
                        title="Manage rooms"
                        class="text-xs text-white/40 hover:text-white/80"
                        @click="manageRooms"
                    >
                        <fa icon="gear" />
                    </button>
                </div>
                <div class="flex flex-col">
                    <SingleRoom v-for="room in publicRooms" :key="room.id" :room="room" :compact="compact" />
                </div>
            </div>

            <!-- Direct messages -->
            <div :class="compact ? 'px-1 pb-2' : 'px-3 pb-2'">
                <div v-if="!compact" class="flex items-center justify-between px-2 my-1">
                    <span class="text-xs font-mono uppercase tracking-wider text-white/30">Direct</span>
                </div>
                <div v-else class="h-px bg-white/5 mx-2 my-2" aria-hidden="true" />
                <div class="flex flex-col">
                    <SingleRoom v-for="room in directRooms" :key="room.id" :room="room" :compact="compact" />
                </div>
            </div>
        </div>
    </div>
</template>
