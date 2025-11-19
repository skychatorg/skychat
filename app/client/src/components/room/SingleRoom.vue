<script setup>
import HoverCard from '@/components/util/HoverCard.vue';
import { useClientState } from '@/composables/useClientState.js';
import { apiClient, useClientStore } from '@/stores/client';
import { computed, ref } from 'vue';
import SkyDropdown from '../common/SkyDropdown.vue';
import SkyDropdownItem from '../common/SkyDropdownItem.vue';

const client = useClientStore();

const props = defineProps({
    room: {
        type: Object,
        required: true,
    },
});

const hasUnread = computed(() => {
    return !selected.value && client.hasAccessToRoom(props.room.id) && client.hasUnreadMessages(props.room.id);
});

const isMuted = ref(false);
useClientState(() => {
    const data = apiClient.plugins.mute.isRoomMuted(props.room.id);
    isMuted.value = data;
});

// Whether user is in the room
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
        // If a room name is set explicitly, use that
        if (props.room.name) {
            return props.room.name;
        }
        // Otherwise, find a relevant name (exclude current user and show other participants)
        const otherUsernames = props.room.whitelist.filter((identifier) => client.state.user.username.toLowerCase() !== identifier);
        if (otherUsernames.length === 0) {
            return `Archive: ${props.room.name}`;
        }
        return `@${otherUsernames.join(', @')}`;
    } else {
        return props.room.name;
    }
});

/**
 * Return whether this room is protected
 */
const isProtected = computed(() => {
    return Boolean(props.room.plugins?.roomprotect);
});

// Choose icon to show and icon color
const icon = computed(() => {
    if (props.room.isPrivate) {
        // If group conv
        if (props.room.whitelist.length > 2) {
            return {
                name: 'users',
                classes: selected.value ? 'text-skygray-white' : 'text-skygray-lightest',
            };
        }
        return {
            name: 'user',
            classes: selected.value ? 'text-skygray-white' : 'text-skygray-lightest',
        };
    }
    if (isProtected.value) {
        return {
            name: 'lock',
            classes: selected.value ? 'text-skygray-white' : 'text-skygray-lightest',
            title: `This room is protected. The minimum right to join is ${props.room.plugins.roomprotect}`,
        };
    }
    return null;
});
</script>

<template>
    <HoverCard
        :use-border-radius="true"
        :border-color="'rgb(var(' + borderColor + '))'"
        :selectable="true"
        :selected="selected"
        :shiny="room.shiny && !selected"
        class="cursor-pointer"
        :class="{
            'opacity-50': isMuted,
        }"
    >
        <div class="flex flex-row gap-2 select-none">
            <!-- Room name -->
            <div
                class="py-2 pl-2 grow whitespace-nowrap w-0 overflow-hidden text-ellipsis pr-2"
                @click="client.state.currentRoomId !== room.id && client.join(room.id)"
            >
                <fa v-if="icon" class="mr-1" :class="icon.classes" :icon="icon.name" :title="icon.title" />
                {{ formattedName }}
            </div>

            <!-- Icons -->
            <div class="py-2 pr-2 flex">
                <!-- Unread -->
                <p v-if="hasUnread && !isMuted" class="text-danger font-bold mr-2" title="This room has unread messages">
                    <fa icon="bell" size="xs" />
                </p>

                <!-- Muted -->
                <p v-if="isMuted" class="font-bold mr-2" title="This room is muted">
                    <fa icon="volume-xmark" size="xs" />
                </p>

                <!-- User count -->
                <p
                    v-show="(client.state.roomConnectedUsers[room.id] || []).length > 0"
                    class="text-primary font-bold"
                    :title="(client.state.roomConnectedUsers[room.id] || []).length + ' users in this room'"
                >
                    <fa icon="users" size="xs" /> {{ (client.state.roomConnectedUsers[room.id] || []).length }}
                </p>

                <!-- Room actions -->
                <SkyDropdown>
                    <template #trigger>
                        <fa icon="chevron-down" class="text-skygray-lightest ml-2" />
                    </template>

                    <template #default>
                        <SkyDropdownItem v-if="client.state.currentRoomId !== room.id" @click="client.join(room.id)">
                            Join
                        </SkyDropdownItem>
                        <SkyDropdownItem v-if="!isMuted" @click="client.sendMessage(`/mute ${room.id}`)"> Mute room </SkyDropdownItem>
                        <SkyDropdownItem v-else @click="client.sendMessage(`/unmute ${room.id}`)"> Unmute room </SkyDropdownItem>
                    </template>
                </SkyDropdown>
            </div>
        </div>
    </HoverCard>
</template>
