<script setup>
import { computed, watch, onMounted, ref } from 'vue';
import { useClientStore } from '@/stores/client';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import SingleRoom from '@/components/room/SingleRoom.vue';
import draggable from 'vuedraggable';

const client = useClientStore();

const publicRooms = computed(() => {
    return client.state.rooms.filter((room) => !room.isPrivate);
});

let sortedRooms = ref(publicRooms.value);
onMounted(() => {
    sortedRooms.value = publicRooms.value;
});
watch(publicRooms, () => {
    sortedRooms.value = publicRooms.value;
});

function onMoved() {
    const sortedRoomIds = sortedRooms.value.map((room) => room.id);
    client.sendMessage('/roomorder ' + sortedRoomIds.join(','));
}
</script>

<template>
    <ModalTemplate id="manageRooms" title="Manage rooms">
        <p class="mb-2 text-sm text-white/40">Drag rooms to change their order</p>

        <!-- Each item is wrapped in a div: vuedraggable marks the item's root element as draggable, and SingleRoom's root renders no element of its own -->
        <draggable v-model="sortedRooms" group="rooms" item-key="id" @end="onMoved">
            <template #item="{ element }">
                <div><SingleRoom :room="element" /></div>
            </template>
        </draggable>
    </ModalTemplate>
</template>
