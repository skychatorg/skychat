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
        Manage rooms

        <draggable v-model="sortedRooms" group="rooms" item-key="id" @end="onMoved">
            <template #item="{ element }">
                <SingleRoom :room="element">{{ element.name }}</SingleRoom>
            </template>
        </draggable>
    </ModalTemplate>
</template>
