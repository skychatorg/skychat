<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import HoverCard from '@/components/util/HoverCard.vue';
import MediaPlayer from '@/components/player/MediaPlayer.vue';
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';

const app = useAppStore();
const client = useClientStore();
</script>

<template>
    <ModalTemplate id="playerQueue" title="Player Queue">
        <div class="text-center py-4 px-4">
            <!-- 1 Entry -->
            <HoverCard v-for="(entry, index) in client.state.player.queue" :key="index" :selectable="false">
                <div class="py-1 px-1 flex">
                    <UserMiniAvatar :user="entry.user" class="mx-2 mt-1" />
                    <div class="text-skygray-lightest w-0 grow overflow-hidden whitespace-nowrap text-ellipsis" :title="entry.video.title">
                        {{ entry.video.title }}
                    </div>
                    <div v-if="client.state.op || entry.user.id === client.state.user.id" class="btn-group mx-2">
                        <button @click="client.sendMessage(`/playerremovevideo ${entry.video.type} ${entry.video.id}`)" class="btn text-xs text-danger">
                            <fa icon="xmark" />
                        </button>
                    </div>
                </div>
            </HoverCard>
        </div>
    </ModalTemplate>
</template>
