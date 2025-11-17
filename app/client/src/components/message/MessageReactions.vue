<script setup>
import { computed } from 'vue';
import { useClientStore } from '@/stores/client';
import MessageReaction from './MessageReaction.vue';

const props = defineProps({
    message: {
        type: Object,
        required: true,
    },
});

const client = useClientStore();

const reactions = computed(() => {
    if (!props.message?.storage?.reactions) {
        return [];
    }

    const storageReactions = props.message.storage.reactions;
    const connectedList = client.state.connectedList || [];
    const connectedUsersByIdentifier = connectedList.reduce((acc, entry) => {
        acc[entry.identifier] = entry.user;
        return acc;
    }, {});
    const currentIdentifier = client.state.user?.username?.toLowerCase() || null;

    return Object.entries(storageReactions).map(([id, identifiers]) => {
        const users = identifiers.map((identifier) => {
            const user = connectedUsersByIdentifier[identifier];
            return {
                identifier,
                username: user?.username || identifier,
                isCurrentUser: identifier === currentIdentifier,
            };
        });

        users.sort((a, b) => {
            if (a.isCurrentUser && !b.isCurrentUser) {
                return -1;
            }
            if (!a.isCurrentUser && b.isCurrentUser) {
                return 1;
            }
            return a.username.localeCompare(b.username);
        });

        return {
            id,
            count: identifiers.length,
            users,
        };
    });
});
</script>

<template>
    <TransitionGroup name="message-reaction" tag="div" class="flex ml-[66px] mb-1">
        <MessageReaction
            v-for="reaction in reactions"
            :key="reaction.id"
            :message-id="props.message.id"
            :reaction="reaction.id"
            :count="reaction.count"
            :users="reaction.users"
        />
    </TransitionGroup>
</template>

<style scoped>
.message-reaction-enter-active,
.message-reaction-leave-active {
    transition: transform 150ms ease, opacity 150ms ease;
}

.message-reaction-enter-from,
.message-reaction-leave-to {
    transform: scale(0.85);
    opacity: 0;
}

.message-reaction-move {
    transition: transform 150ms ease;
}
</style>
