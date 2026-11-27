<script setup>
defineProps({
    user: {
        type: Object,
        required: true,
    },
});
</script>

<!-- The title a user rents in the shop, next to their name -->
<template>
    <span
        v-if="user.data?.plugins?.custom?.title"
        class="shrink min-w-0 truncate px-1.5 rounded bg-white/[.06] text-xs font-normal not-italic text-white/60"
        >{{ user.data.plugins.custom.title }}</span
    >
</template>
