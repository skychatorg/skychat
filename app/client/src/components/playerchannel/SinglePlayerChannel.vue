<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';

const app = useAppStore();
const client = useClientStore();

const props = defineProps({
    playerChannel: {
        type: Object,
        required: true,
    },
});

// Users in current player channel
const usersRef = computed(() => {
    return client.state.playerChannelUsers[props.playerChannel.id] || [];
});

</script>

<template>
    <HoverCard
        :useBorderRadius="true"
        :borderColor="'rgb(var(--color-secondary))'"
        :selectable="true"
        :selected="client.state.currentPlayerChannelId === props.playerChannel.id"
        @click="client.sendMessage(`/playerchannel ${client.state.currentPlayerChannelId === props.playerChannel.id ? 'leave' : 'join'} ${props.playerChannel.id}`)"
    >
        <div class="px-3 py-1 select-none">

            <!-- Channel info -->
            <div class="h-6">

                <!-- Channel name -->
                {{ props.playerChannel.name }}

                <!-- If playing, show media title -->
                <template v-if="props.playerChannel.playing">
                    {{ props.playerChannel.currentMedia.title }}
                </template>
            </div>

            <!-- Show users in media channel -->
            <div class="h-6 pt-1 flex justify-start space-x-1">
                <UserMiniAvatar
                    v-for="user in usersRef"
                    :key="user.id"
                    :user="user"
                />
            </div>
        </div>
    </HoverCard>
</template>

<style scoped>

</style>
