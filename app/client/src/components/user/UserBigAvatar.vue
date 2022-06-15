<script setup>

const props = defineProps({
    user: {
        type: Object,
        required: true,
    },
});

</script>

<template>
    <div
        class="w-10 h-10 rounded-xl border border-2 overflow-hidden bg-black"
        :style="{
            borderColor: props.user.data.plugins.color,
        }"
        :title="props.user.username"
    >
        <img :src="props.user.data.plugins.avatar" class="h-full object-cover" />
    </div>
</template>

<style scoped>
</style>
