<script setup>
import { computed } from 'vue';
import MessageReaction from './MessageReaction.vue';

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
</script>

<template>
    <div class="flex ml-[66px] mb-1">
        <MessageReaction
            v-for="reaction in reactions"
            :key="reaction.id"
            :message-id="props.message.id"
            :reaction="reaction.id"
            :count="reaction.count"
        />
    </div>
</template>
