<script setup>
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';

const props = defineProps({
    users: {
        type: Array,
        required: true,
    },
});
</script>

<template>
    <div class="flex justify-center -space-x-1.5">
        <UserMiniAvatar v-for="user in users" :key="user.identifier" :user="user" class="transition transition-all hover:-translate-y-0.5 hover:scale-125" />
    </div>
</template>

<style scoped></style>
