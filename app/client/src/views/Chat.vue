<script setup>
import MessagePannel from '@/components/message/MessagePannel.vue';
import NewMessageForm from '@/components/message/NewMessageForm.vue';
import PlayerPannel from '@/components/player/PlayerPannel.vue';
import PlayerChannelList from '@/components/playerchannel/PlayerChannelList.vue';
import PollList from '@/components/poll/PollList.vue';
import RoomList from '@/components/room/RoomList.vue';
import ConnectedList from '@/components/user/ConnectedList.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const app = useAppStore();
const client = useClientStore();

const canManageStickers = computed(() => {
    const threshold = client.state.config?.minRightForStickerManagement ?? 'op';
    if (threshold === 'op') {
        return client.state.op;
    }
    const userRight = client.state.user?.right ?? -1;
    return client.state.op || userRight >= threshold;
});
</script>

<template>
    <div class="chat-view relative h-0 flex flex-row grow">
        <div
            class="h-full flex flex-col bg-skygray-lighter/5 backdrop-blur-2xl backdrop-brightness-125 w-full lg:w-[var(--page-col-left-width)] lg:flex"
            :class="{
                hidden: app.mobileView !== 'left',
            }"
        >
            <RoomList class="pl-2 pr-4 my-6 flex-grow" />
            <PlayerChannelList class="pl-2 pr-4 mt-3 mb-2" />
            <div class="p-2 text-end lg:hidden">
                <button class="form-control mr-2" @click="app.mobileSetView('middle')">
                    <fa icon="comments" class="mr-2" />
                    <fa icon="chevron-right" />
                </button>
                <button class="form-control" @click="app.mobileSetView('right')">
                    <fa icon="users" class="mr-2" />
                    <fa icon="chevron-right" />
                </button>
            </div>
        </div>

        <div
            class="w-0 grow h-full flex flex-col lg:flex"
            :class="{
                hidden: app.mobileView !== 'middle',
            }"
        >
            <PlayerPannel v-if="client.state.currentPlayerChannel" class="bg-skygray-lighter/5 backdrop-blur-2xl backdrop-brightness-125" />
            <PollList class="bg-skygray-lighter/5 backdrop-blur-2xl backdrop-brightness-125" />
            <MessagePannel class="grow bg-skygray-white/10 backdrop-brightness-125 backdrop-blur-2xl" />
            <NewMessageForm class="basis-12 bg-skygray-lighter/5 backdrop-blur-2xl backdrop-brightness-125" />
        </div>

        <div
            class="h-full flex flex-col bg-skygray-lighter/5 backdrop-blur-2xl backdrop-brightness-125 lg:flex w-full lg:w-[var(--page-col-right-width)] lg:flex"
            :class="{
                hidden: app.mobileView !== 'right',
            }"
        >
            <ConnectedList class="pl-2 pr-4 mt-6 grow h-0 overflow-y-auto scrollbar" />
            <div class="pl-4 pr-6 mt-3 mb-2 grid grid-cols-2 gap-4">
                <button
                    v-if="client.state.config.galleryEnabled"
                    title="Open gallery"
                    class="form-control col-start-1 col-span-1"
                    :class="{
                        'text-tertiary': client.state.ongoingConverts.length > 0,
                    }"
                    @click="app.toggleModal('gallery')"
                >
                    <fa icon="folder-tree" />
                </button>
                <button
                    v-show="true"
                    title="Open user settings"
                    class="form-control col-start-2 col-span-1"
                    @click="app.toggleModal('profile')"
                >
                    <fa icon="gears" />
                </button>
            </div>
            <div v-if="canManageStickers" class="pl-4 pr-6 mb-2">
                <button class="form-control w-full" @click="app.toggleModal('manageStickers')">
                    <fa icon="image" class="mr-2" />
                    Manage stickers
                </button>
            </div>
            <div class="p-2 lg:hidden">
                <button class="form-control mr-2" @click="app.mobileSetView('left')">
                    <fa icon="chevron-left" class="mr-2" />
                    <fa icon="gears" />
                </button>
                <button class="form-control" @click="app.mobileSetView('middle')">
                    <fa icon="chevron-left" class="mr-2" />
                    <fa icon="comments" />
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.chat-view {
    width: 100%;
    max-width: var(--page-max-width);
    margin: 0 auto;
}
.left-col {
    width: var(--page-col-left-width);
    max-width: var(--page-col-left-width);
    min-width: var(--page-col-left-width);
}
.right-col {
    width: var(--page-col-right-width);
    max-width: var(--page-col-right-width);
    min-width: var(--page-col-right-width);
}
</style>
