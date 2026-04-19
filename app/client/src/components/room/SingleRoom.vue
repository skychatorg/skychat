<script setup>
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

const dropdownOpen = ref(false);

const selected = computed(() => {
    return client.state.currentRoomId === props.room.id;
});

const hasUnread = computed(() => {
    return !selected.value && client.hasAccessToRoom(props.room.id) && client.hasUnreadMessages(props.room.id);
});

const isMuted = ref(false);
useClientState(() => {
    isMuted.value = apiClient.plugins.mute.isRoomMuted(props.room.id);
});

const isProtected = computed(() => {
    return Boolean(props.room.plugins?.roomprotect);
});

const isGroup = computed(() => {
    return props.room.isPrivate && (props.room.whitelist?.length ?? 0) > 2;
});

const formattedName = computed(() => {
    if (props.room.isPrivate) {
        if (props.room.name) {
            return props.room.name;
        }
        const otherUsernames = props.room.whitelist.filter((identifier) => client.state.user.username.toLowerCase() !== identifier);
        if (otherUsernames.length === 0) {
            return `Archive: ${props.room.name}`;
        }
        return `@${otherUsernames.join(', @')}`;
    }
    return props.room.name;
});

const userCount = computed(() => (client.state.roomConnectedUsers[props.room.id] || []).length);

const joinRoom = () => {
    if (client.state.currentRoomId !== props.room.id) {
        client.join(props.room.id);
    }
};

const markAsRead = () => {
    const lastMessageId = props.room.lastReceivedMessageId;
    if (lastMessageId) {
        client.sendMessage(`/lastseen ${lastMessageId}`);
    }
};

const copyRoomId = () => {
    navigator.clipboard.writeText(props.room.id.toString());
};

const leaveRoom = () => {
    const otherRoom = client.state.rooms.find((r) => r.id !== props.room.id && client.hasAccessToRoom(r.id));
    if (otherRoom) {
        client.join(otherRoom.id);
    }
};
</script>

<template>
    <div
        class="group relative w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition cursor-pointer select-none"
        :class="[
            selected
                ? 'bg-primary/10 text-white ring-1 ring-primary/30'
                : hasUnread
                ? 'text-white hover:bg-white/5'
                : 'text-white/60 hover:text-white hover:bg-white/5',
            isMuted ? 'opacity-50' : '',
        ]"
        @click="joinRoom"
    >
        <div v-if="selected" class="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-primary" />

        <!-- Icon slot -->
        <span
            class="w-4 text-center text-xs shrink-0"
            :class="selected ? 'text-primary' : 'text-white/40'"
            :title="isProtected ? `Protected room (min right ${room.plugins.roomprotect})` : undefined"
        >
            <fa v-if="room.isPrivate && isGroup" icon="users" />
            <fa v-else-if="room.isPrivate" icon="at" />
            <fa v-else-if="isProtected" icon="lock" />
            <span v-else class="font-mono">#</span>
        </span>

        <!-- Name -->
        <span class="flex-1 truncate text-sm">{{ formattedName }}</span>

        <!-- Muted icon -->
        <fa v-if="isMuted" icon="volume-xmark" class="text-xs text-white/30" title="Muted" />

        <!-- User count (shown when no unread) -->
        <span
            v-if="userCount > 0 && !hasUnread"
            class="font-mono text-xs text-white/30 tabular-nums"
            :title="userCount + ' users in this room'"
        >
            {{ userCount }}
        </span>

        <!-- Unread dot -->
        <span v-if="hasUnread" class="w-2 h-2 rounded-full bg-primary shrink-0" title="Unread messages" />

        <!-- Actions dropdown -->
        <span @click.stop>
            <SkyDropdown v-model:open="dropdownOpen">
                <template #trigger>
                    <button
                        class="ml-1 px-1 py-0.5 rounded text-xs transition opacity-0 group-hover:opacity-100"
                        :class="dropdownOpen ? 'bg-primary/20 text-primary opacity-100' : 'text-white/40 hover:text-white/80'"
                    >
                        <fa icon="ellipsis" />
                    </button>
                </template>

                <template #default>
                    <SkyDropdownItem v-if="!selected" @click="joinRoom">
                        <fa icon="arrow-right-from-bracket" class="w-4 mr-2" />
                        Join room
                    </SkyDropdownItem>
                    <SkyDropdownItem v-if="selected" @click="leaveRoom">
                        <fa icon="arrow-left" class="w-4 mr-2" />
                        Leave room
                    </SkyDropdownItem>
                    <SkyDropdownItem v-if="hasUnread" @click="markAsRead">
                        <fa icon="circle-dot" class="w-4 mr-2" />
                        Mark as read
                    </SkyDropdownItem>
                    <SkyDropdownItem v-if="!isMuted" @click="client.sendMessage(`/mute ${room.id}`)">
                        <fa icon="volume-xmark" class="w-4 mr-2" />
                        Mute room
                    </SkyDropdownItem>
                    <SkyDropdownItem v-else @click="client.sendMessage(`/unmute ${room.id}`)">
                        <fa icon="bell" class="w-4 mr-2" />
                        Unmute room
                    </SkyDropdownItem>
                    <SkyDropdownItem @click="copyRoomId">
                        <fa icon="copy" class="w-4 mr-2" />
                        Copy room ID
                    </SkyDropdownItem>
                </template>
            </SkyDropdown>
        </span>
    </div>
</template>
