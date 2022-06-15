<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';
import MediaPlayer from '@/components/player/MediaPlayer.vue';
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';

const app = useAppStore();
const client = useClientStore();


</script>

<template>
    <div class="text-center py-4 px-4">

        <!-- 1 Entry -->
        <HoverCard
            v-for="(entry, index) in client.state.player.queue"
            :key="index"
            :selectable="false"
        >
            <div class="py-1 px-1 flex">
                <UserMiniAvatar
                    :user="entry.user"
                    class="mx-2 mt-1"
                />
                <div
                    class="text-skygray-lightest w-0 grow overflow-hidden whitespace-nowrap text-ellipsis"
                    :title="entry.video.title"
                >
                    {{ entry.video.title }}
                </div>
                <div class="mx-2 text-skygray-lighter">
                    3m
                </div>
            </div>
        </HoverCard>
    </div>
</template>

<style scoped>
</style>
