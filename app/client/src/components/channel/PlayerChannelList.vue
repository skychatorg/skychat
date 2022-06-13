<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';

const app = useAppStore();
const client = useClientStore();

</script>

<template>
    <div>
        <h2 class="pl-4 font-bold text-skygray-casual">Media channels</h2>
        <div>
            <HoverCard
                v-for="playerChannel in client.state.playerChannels"
                :key="playerChannel.id"
                :useBorderRadius="true"
                :borderColor="'rgb(var(--color-tertiary))'"
                :selectable="true"
                :selected="client.state.currentPlayerChannelId === playerChannel.id"
                @click="client.sendMessage(`/playerchannel ${client.state.currentPlayerChannelId === playerChannel.id ? 'leave' : 'join'} ${playerChannel.id}`)"
            >
                <div class="py-2 px-3 select-none">

                    <!-- Channel info -->
                    <div>

                        <!-- Channel name -->
                        {{ playerChannel.name }}

                        <!-- If playing, show media title -->
                        <template v-if="playerChannel.playing">
                            {{ playerChannel.currentMedia.title }}
                        </template>
                    </div>

                    <!-- Show users in media channel -->
                    <div
                        v-for="user in client.state.playerChannelUsers[playerChannel.id]"
                        :key="user.id"
                        class="flex justify-start -space-x-1.5"
                    >
                        <img alt="user.name" class="w-6 h-6 rounded-full bg-slate-100 ring-2 ring-white" loading="lazy">
                    </div>
                </div>
            </HoverCard>
        </div>
    </div>
</template>

<style scoped>

</style>
