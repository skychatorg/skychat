<script setup>
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const props = defineProps({
    message: {
        type: Object,
        required: true,
    },
});

const reactions = computed(() => {
    if (!props.message?.storage?.reactions) {
        return [];
    }

    const storageReactions = props.message.storage.reactions;

    return Object.entries(storageReactions).map(([id, users]) => {
        return {
            id,
            count: users.length,
        };
    });
});

const client = useClientStore();
</script>

<template>
    <div class="flex ml-[66px] mb-1">
        <button
            v-for="reaction in reactions"
            :key="reaction.id"
            class="flex items-center bg-skygray-dark/25 rounded-full px-2 py-1 mr-1"
            @click="client.sendMessage(`/reaction ${props.message.id} ${reaction.id}`)"
        >
            <div class="text-xs text-gray-500">{{ reaction.id }} {{ reaction.count }}</div>
        </button>
    </div>
</template>
