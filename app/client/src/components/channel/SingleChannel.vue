<script setup>
import { defineProps, computed } from 'vue';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';

const client = useClientStore();

const props = defineProps({
    room: {
        type: Object,
        required: true,
    },
});

// Whether has unread
const hasUnreadRef = computed(() => {

    if (client.state.user.id === 0) {
        return false;
    }

    // If already in this room, don't show unread
    if (client.state.currentRoomId === props.room.id) {
        return false;
    }

    // If never seen any message in this room, then it's unread
    if (typeof client.state.user.data.plugins.lastseen[props.room.id] === 'undefined') {
        return true;
    }

    // Check last seen id vs last received id
    const lastSeenId = client.state.user.data.plugins.lastseen[props.room.id];
    return props.room.lastReceivedMessageId > lastSeenId;
});

// Whether this room is selected
const selectedRef = computed(() => {
    return client.state.currentRoomId === props.room.id;
});

// Choose border color
const borderColorRef = computed(() => {
    if (selectedRef.value) {
        return '--color-skygray-white';
    } else if (hasUnreadRef.value) {
        return '--color-warn';
    } else if (props.room.isPrivate) {
        return '--color-skygray-lighter';
    } else {
        return '--color-skygray-white';
    }
});

// Choose icon to show and icon color
const iconRef = computed(() => {
    return {
        name: props.room.isPrivate ? 'lock' : 'globe',
        classes: selectedRef.value ? 'text-skygray-white' : 'text-skygray-lightest',
    };
});

</script>

<template>
    <HoverCard
        :useBorderRadius="true"
        :borderColor="'rgb(var(' + borderColorRef + '))'"
        :selectable="true"
        :selected="selectedRef"
    >
        <div
            @click="client.join(props.room.id)"
            class="py-2 px-3 flex flex-row select-none"
        >

            <!-- Room name -->
            <div class="grow">
                <fa class="mr-1" :class="iconRef.classes" :icon="iconRef.name" />
                {{ props.room.name }}
            </div>

            <!-- Icons -->
            <div class="flex">

                <!-- Unread -->
                <p
                    v-if="hasUnreadRef"
                    class="text-warn font-bold mr-2"
                    title="This channel has unread messages"
                >
                    <fa icon="circle-dot" size="xs" />
                </p>

                <!-- User count -->
                <p
                    v-show="(client.state.roomConnectedUsers[props.room.id] || []).length > 0"
                    class="text-primary font-bold"
                    :title="((client.state.roomConnectedUsers[props.room.id] || []).length) + ' users in this channel'"
                >
                    <fa icon="users" size="xs" /> {{ (client.state.roomConnectedUsers[props.room.id] || []).length }}
                </p>
            </div>
        </div>
    </HoverCard>
</template>

<style scoped>

</style>
