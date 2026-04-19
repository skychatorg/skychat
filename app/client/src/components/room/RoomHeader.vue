<script setup>
defineProps({
    room: {
        type: Object,
        default: null,
    },
});
</script>

<template>
    <div v-if="room" class="flex items-center gap-3 px-4 py-2 hairline text-sm" :style="{ background: 'var(--surface-2)' }">
        <div class="flex items-center gap-2 min-w-0">
            <fa icon="hashtag" class="text-white/30" />
            <span class="font-semibold truncate">{{ room.name }}</span>
        </div>
    </div>
</template>
