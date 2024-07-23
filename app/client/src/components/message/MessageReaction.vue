<script setup>
import { useClientStore } from '@/stores/client';

const props = defineProps({
    reaction: {
        type: String,
        required: true,
    },
    messageId: {
        type: Number,
        required: false,
        default: null,
    },
    count: {
        type: Number,
        required: false,
        default: null,
    },
});

const client = useClientStore();

function onClick() {
    if (!props.messageId) {
        return;
    }
    client.sendMessage(`/reaction ${props.messageId} ${props.reaction}`);
}
</script>

<template>
    <button class="flex items-center bg-skygray-dark/25 rounded-full px-2 py-1 mr-1" @click="onClick">
        <div class="text-xs text-gray-500">
            {{ reaction }}<template v-if="count !== null"> {{ count }}</template>
        </div>
    </button>
</template>
