<script setup>
import UserMiniAvatarCollection from '@/components/user/UserMiniAvatarCollection.vue';
import { roomName } from '@/lib/roomName.js';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const MAX_AVATARS = 6;

const client = useClientStore();

const props = defineProps({
    room: {
        type: Object,
        default: null,
    },
});

const name = computed(() => roomName(props.room, client.state.user.username));

const sessionsByIdentifier = computed(() =>
    Object.fromEntries((client.state.connectedList || []).map((entry) => [entry.identifier, entry])),
);

/**
 * Public rooms only show who is in them. Private rooms also show the rest of the whitelist, split
 * between online elsewhere and away; those with no live session are known by identifier only, so
 * they render as a placeholder square.
 */
const members = computed(() => {
    const buckets = { inRoom: [], online: [], offline: [] };
    if (!props.room) {
        return buckets;
    }
    if (!props.room.isPrivate) {
        buckets.inRoom = client.state.roomConnectedUsers[props.room.id] ?? [];
        return buckets;
    }
    for (const identifier of props.room.whitelist ?? []) {
        const entry = sessionsByIdentifier.value[identifier];
        const user = entry?.user ?? { username: identifier };
        if (!entry || entry.deadSinceTime) {
            buckets.offline.push(user);
        } else if (entry.rooms.includes(props.room.id)) {
            buckets.inRoom.push(user);
        } else {
            buckets.online.push(user);
        }
    }
    return buckets;
});

const groups = computed(() =>
    [
        { key: 'inRoom', label: 'Here', class: '', users: members.value.inRoom },
        { key: 'online', label: 'Online', class: 'opacity-60', users: members.value.online },
        { key: 'offline', label: 'Away', class: 'opacity-40 grayscale', users: members.value.offline },
    ]
        .filter((group) => group.users.length > 0)
        .map((group) => ({
            ...group,
            shown: group.users.slice(0, MAX_AVATARS),
            hidden: group.users.slice(MAX_AVATARS).map((user) => user.username),
        })),
);
</script>

<template>
    <div v-if="room" class="flex items-center gap-3 px-4 py-2 hairline text-sm" :style="{ background: 'var(--surface-2)' }">
        <div class="flex items-center gap-2 min-w-0">
            <fa :icon="room.isPrivate ? 'at' : 'hashtag'" class="text-white/30" />
            <span class="font-semibold truncate">{{ name }}</span>
        </div>

        <div v-if="groups.length > 0" class="ml-auto shrink-0 flex items-center gap-2">
            <span class="text-[10px] font-mono uppercase tracking-wider text-white/30">Online</span>
            <template v-for="(group, index) in groups" :key="group.key">
                <span v-if="index > 0" class="w-px h-3 bg-white/10" />
                <div class="flex items-center gap-1.5" :title="group.label">
                    <UserMiniAvatarCollection :users="group.shown" :class="group.class" />
                    <span
                        v-if="group.hidden.length > 0"
                        class="font-mono text-xs text-white/40 tabular-nums"
                        :title="group.hidden.join(', ')"
                    >
                        +{{ group.hidden.length }}
                    </span>
                </div>
            </template>
        </div>
    </div>
</template>
