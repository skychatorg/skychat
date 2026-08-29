<script setup>
import { roomName } from '@/lib/roomName.js';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const client = useClientStore();

const props = defineProps({
    room: {
        type: Object,
        default: null,
    },
});

const name = computed(() => roomName(props.room, client.state.user.username));
</script>

<template>
    <div v-if="room" class="flex items-center gap-3 px-4 py-2 hairline text-sm" :style="{ background: 'var(--surface-2)' }">
        <div class="flex items-center gap-2 min-w-0">
            <fa :icon="room.isPrivate ? 'at' : 'hashtag'" class="text-white/30" />
            <span class="font-semibold truncate">{{ name }}</span>
        </div>
    </div>
</template>
