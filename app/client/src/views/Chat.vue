<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import RoomList from '@/components/room/RoomList.vue';
import PlayerChannelList from '@/components/playerchannel/PlayerChannelList.vue';
import PlayerPannel from '@/components/player/PlayerPannel.vue';
import MessagePannel from '@/components/message/MessagePannel.vue';
import NewMessageForm from '@/components/message/NewMessageForm.vue';
import ConnectedList from '@/components/user/ConnectedList.vue';

const app = useAppStore();
const client = useClientStore();

</script>

<template>
    <div class="chat-view h-0 flex flex-row grow">
        
        <div
            class="
                h-full flex flex-col bg-skygray-lighter/10 backdrop-brightness-125
                w-full lg:w-[var(--page-col-left-width)] lg:flex
            "
            :class="{
                'hidden': app.mobileView !== 'left',
            }"
        >
            <RoomList class="pl-2 pr-4 my-6 grow overflow-y-auto scrollbar" />
            <PlayerChannelList class="pl-2 pr-4 mt-3 mb-2" />
            <div class="p-2 text-end lg:hidden">
                <button
                    class="form-control mr-2"
                    @click="app.mobileSetView('middle')"
                >
                    <fa icon="comments" class="mr-2" />
                    <fa icon="chevron-right" />
                </button>
                <button
                    class="form-control"
                    @click="app.mobileSetView('right')"
                >
                    <fa icon="users" class="mr-2" />
                    <fa icon="chevron-right" />
                </button>
            </div>
        </div>

        <div
            class="
                w-0 grow h-full flex flex-col
                lg:flex
            "
            :class="{
                'hidden': app.mobileView !== 'middle',
            }"
        >
            <PlayerPannel class="bg-skygray-lighter/10 backdrop-brightness-125" />
            <MessagePannel class="grow bg-skygray-white/10 backdrop-brightness-150" />
            <NewMessageForm class="basis-12 bg-skygray-lighter/10 backdrop-brightness-125" />
        </div>

        <div
            class="
                h-full flex flex-col bg-skygray-lighter/10 backdrop-brightness-125
                lg:flex
                w-full lg:w-[var(--page-col-right-width)] lg:flex
            "
            :class="{
                'hidden': app.mobileView !== 'right',
            }"
        >
            <ConnectedList class="pl-2 pr-4 mt-6 grow h-0 overflow-y-auto scrollbar" />
            <div class="p-2 lg:hidden">
                <button
                    class="form-control mr-2"
                    @click="app.mobileSetView('left')"
                >
                    <fa icon="chevron-left" class="mr-2" />
                    <fa icon="gears" />
                </button>
                <button
                    class="form-control"
                    @click="app.mobileSetView('middle')"
                >
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
