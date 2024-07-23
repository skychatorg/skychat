<script setup>
import { useClientStore } from '@/stores/client';
import MessageReaction from './MessageReaction.vue';

defineProps({
    messageId: {
        type: Number,
        required: true,
    },
});

const client = useClientStore();
</script>

<template>
    <div class="flex ml-[66px] mb-1">
        <MessageReaction v-for="reaction in client.state.reactions" :key="reaction" :message-id="messageId" :reaction="reaction" />
    </div>
</template>
