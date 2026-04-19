<script setup>
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

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
        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        :class="hasReacted ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-white/5 text-white/70 hairline hover:bg-white/10'"
        :aria-label="tooltipText ? 'Reactions by: ' + tooltipText : 'Message reaction'"
        :title="tooltipText ? 'Reactions by: ' + tooltipText : null"
        @click="onClick"
    >
        <span v-if="!stickerUrl">{{ reaction }}</span>
        <img v-else :src="stickerUrl" :alt="reaction" :title="reaction" class="w-4 h-4 object-contain" loading="lazy" />
        <span v-if="count !== null" class="tabular-nums">{{ count }}</span>
    </button>
</template>
