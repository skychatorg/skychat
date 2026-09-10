<script setup>
import { computed } from 'vue';

const props = defineProps({
    user: {
        type: Object,
        required: true,
    },
});

// Users we only know by name (eg. an offline room member) carry no avatar nor color.
const avatar = computed(() => props.user.data?.plugins?.avatar ?? null);
const color = computed(() => props.user.data?.plugins?.custom?.color ?? 'rgba(255, 255, 255, 0.2)');
// Guest identifiers are prefixed with '*', which makes for a useless initial.
const initial = computed(() => props.user.username.match(/[a-z0-9]/i)?.[0] ?? props.user.username[0]);
</script>

<template>
    <div
        class="w-4 h-4 rounded border-2 overflow-hidden bg-black"
        :class="{ 'flex items-center justify-center': !avatar }"
        :style="{ borderColor: color }"
        :title="user.username"
    >
        <img v-if="avatar" :src="avatar" class="h-full object-cover" />
        <span v-else class="text-[8px] leading-none text-white/50 uppercase">{{ initial }}</span>
    </div>
</template>

<style scoped></style>
