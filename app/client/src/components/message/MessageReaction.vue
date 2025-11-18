<script setup>
import { computed } from 'vue';
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
    users: {
        type: Array,
        required: false,
        default: () => [],
    },
});

const client = useClientStore();

function onClick() {
    if (!props.messageId) {
        return;
    }
    client.sendMessage(`/reaction ${props.messageId} ${props.reaction}`);
}

const tooltipText = computed(() => {
    if (!props.users.length) {
        return '';
    }
    const names = props.users.map((user) => (user.isCurrentUser ? 'You' : user.username));
    if (names.length <= 4) {
        return names.join(', ');
    }
    const [first, second, third, fourth] = names;
    const shown = [first, second, third, fourth].filter(Boolean);
    return `${shown.join(', ')} +${names.length - shown.length}`;
});

const hasReacted = computed(() => props.users.some((user) => user.isCurrentUser));

const stickerUrl = computed(() => {
    const stickers = client.state.stickers || {};
    return stickers[props.reaction] || null;
});
</script>

<template>
    <button
        class="flex items-center rounded-full px-2 py-1 mr-1 border transition text-xs gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 hover:-translate-y-0.5 hover:shadow-sm hover:shadow-primary/20 active:translate-y-0"
        :class="{
            'border-primary/80 bg-primary/10 text-primary': hasReacted,
            'border-transparent bg-skygray-dark/25 text-gray-500 hover:border-skygray-light/60': !hasReacted,
        }"
        :aria-label="tooltipText ? 'Reactions by: ' + tooltipText : 'Message reaction'"
        :title="tooltipText ? 'Reactions by: ' + tooltipText : null"
        @click="onClick"
    >
        <span v-if="!stickerUrl">{{ reaction }}</span>
        <img
            v-else
            :src="stickerUrl"
            :alt="reaction"
            :title="reaction"
            class="w-5 h-5 object-contain"
            loading="lazy"
        />
        <span v-if="count !== null">{{ count }}</span>
    </button>
</template>
