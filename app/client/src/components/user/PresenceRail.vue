<script setup>
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const client = useClientStore();

const items = computed(() => {
    const rooms = client.state.rooms || [];
    const byRoom = client.state.roomConnectedUsers || {};
    return rooms
        .map((room) => ({ room, users: byRoom[room.id] || [] }))
        .filter((it) => it.users.length > 0)
        .sort((a, b) => b.users.length - a.users.length)
        .slice(0, 3);
});
</script>

<template>
    <div v-if="items.length > 0" class="px-3 pb-2">
        <div class="text-xs font-mono uppercase tracking-wider text-white/30 mb-1.5 px-1">Now in rooms</div>
        <div class="flex flex-col gap-1">
            <div v-for="it in items" :key="it.room.id" class="flex items-center gap-2 px-2 py-1 rounded-md hairline bg-white/[.02] text-sm">
                <fa icon="hashtag" class="text-primary" />
                <span class="text-white/70 truncate">{{ it.room.name }}</span>
                <span class="ml-auto font-mono text-xs text-white/40 tabular-nums">{{ it.users.length }}</span>
                <div class="flex -space-x-1.5">
                    <div
                        v-for="user in it.users.slice(0, 3)"
                        :key="user.username"
                        class="w-3.5 h-3.5 rounded-full border border-[var(--surface)] overflow-hidden bg-black"
                        :title="user.username"
                    >
                        <img :src="user.data.plugins.avatar" :alt="user.username" class="h-full w-full object-cover" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
