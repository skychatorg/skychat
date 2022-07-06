<script setup>
import { computed } from 'vue';
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
const hasUnread = computed(() => {

    if (client.state.user.id === 0) {
        return false;
    }

    // If already in this room, don't show unread
    if (client.state.currentRoomId === props.room.id) {
        return false;
    }

    // Check last seen message in this room vs last received message in this room
    return (client.state.user.data.plugins.lastseen[props.room.id] || 0) < props.room.lastReceivedMessageId;
});

// Whether this room is selected
const selected = computed(() => {
    return client.state.currentRoomId === props.room.id;
});

// Choose border color
const borderColor = computed(() => {
    if (hasUnread.value) {
        return '--color-danger';
    } else if (props.room.isPrivate) {
        return '--color-skygray-lightest';
    } else {
        return '--color-skygray-lightest';
    }
});

// Formatted room name
const formattedName = computed(() => {
    if (props.room.isPrivate) {
        const otherUsernames = props.room.whitelist.filter(identifier => client.state.user.username.toLowerCase() !== identifier);
        return `@${otherUsernames.join(', @')}`;
    } else {
        return props.room.name;
    }
});

// Choose icon to show and icon color
const icon = computed(() => {
    if (props.room.isPrivate) {
        return {
            name: 'lock',
            classes: selected.value ? 'text-skygray-white' : 'text-skygray-lightest',
        };
    }
    return null;
});

</script>

<template>
    <HoverCard
        :useBorderRadius="true"
        :borderColor="'rgb(var(' + borderColor + '))'"
        :selectable="true"
        :selected="selected"
        class="cursor-pointer"
    >
        <div
            @click="client.state.currentRoomId !== room.id && client.join(room.id)"
            class="py-2 px-3 flex flex-row select-none"
        >

            <!-- Room name -->
            <div
                :title="formattedName"
                class="grow whitespace-nowrap w-0 overflow-hidden text-ellipsis pr-2"
            >
                <fa v-if="icon" class="mr-1" :class="icon.classes" :icon="icon.name" />
                {{ formattedName }}
            </div>

            <!-- Icons -->
            <div class="flex">

                <!-- Unread -->
                <p
                    v-if="hasUnread"
                    class="text-danger font-bold mr-2"
                    title="This room has unread messages"
                >
                    <fa icon="bell" size="xs" />
                </p>

                <!-- User count -->
                <p
                    v-show="(client.state.roomConnectedUsers[room.id] || []).length > 0"
                    class="text-primary font-bold"
                    :title="((client.state.roomConnectedUsers[room.id] || []).length) + ' users in this room'"
                >
                    <fa icon="users" size="xs" /> {{ (client.state.roomConnectedUsers[room.id] || []).length }}
                </p>
            </div>
        </div>
    </HoverCard>
</template>

<style scoped>

</style>
