<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';
import UserMiniAvatarCollection from '@/components/user/UserMiniAvatarCollection.vue';

const app = useAppStore();
const client = useClientStore();

const props = defineProps({
    playerChannel: {
        type: Object,
        required: true,
    },
});

// Users in current player channel
const users = computed(() => {
    return client.state.playerChannelUsers[props.playerChannel.id] || [];
});

// Owner user object
const owner = computed(() => {
    const entry = client.state.connectedList.find((entry) => entry.identifier === props.playerChannel.currentMedia.owner.toLowerCase()) || null;
    return entry ? entry.user : null;
});
</script>

<template>
    <HoverCard
        :use-border-radius="true"
        :border-color="'rgb(var(--color-skygray-lightest))'"
        :selectable="true"
        :selected="client.state.currentPlayerChannelId === playerChannel.id"
        @click="client.sendMessage(`/playerchannel ${client.state.currentPlayerChannelId === playerChannel.id ? 'leave' : 'join'} ${playerChannel.id}`)"
        class="cursor-pointer"
    >
        <div class="px-3 py-1 grid grid-cols-4 gap-1">
            <!-- Title -->
            <div class="h-6 col-start-1 col-span-1 overflow-hidden text-ellipsis" :title="playerChannel.name">
                {{ playerChannel.name }}
            </div>

            <!-- Current media -->
            <div class="h-6 col-start-2 col-span-3 overflow-hidden text-ellipsis">
                <p v-if="playerChannel.playing" :title="`${playerChannel.currentMedia.title} - added by ${playerChannel.currentMedia.owner}`">
                    {{ playerChannel.currentMedia.title }}
                </p>
            </div>

            <!-- Media owner -->
            <div v-if="playerChannel.playing && owner" class="h-4 col-start-1 col-span-1 flex">
                <template v-if="owner">
                    <UserMiniAvatar :title="`${owner.username} is the current media owner`" :user="owner" />
                </template>
            </div>

            <!-- Users -->
            <div class="h-4 col-start-2 col-span-3 flex justify-end -space-x-1.5">
                <UserMiniAvatarCollection :users="users" />
            </div>
        </div>
    </HoverCard>
</template>

<style scoped></style>
