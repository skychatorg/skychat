<script setup>
import { useClientStore } from '@/stores/client';
import RoomList from '@/components/room/RoomList.vue';
import PlayerChannelList from '@/components/playerchannel/PlayerChannelList.vue';
import PlayerPannel from '@/components/player/PlayerPannel.vue';
import MessagePannel from '@/components/message/MessagePannel.vue';
import NewMessageForm from '@/components/message/NewMessageForm.vue';
import ConnectedList from '@/components/user/ConnectedList.vue';

const client = useClientStore();

</script>

<template>
    <div class="chat-view h-0 flex flex-row grow">
        
        <div class="left-col h-full flex flex-col bg-skygray-darker/50">
            <div class="pl-2 pr-4 py-6 grow">
                <RoomList />
            </div>
            <div class="pl-2 pr-4 py-6">
                <PlayerChannelList />
            </div>
        </div>

        <div class="middle-col grow h-full flex flex-col bg-skygray-darker/50">
            <div class="">
                <PlayerPannel />
            </div>
            <MessagePannel class="grow" />
            <div class="basis-12">
                <NewMessageForm />
            </div>
        </div>

        <div class="right-col h-full p-4 bg-skygray-darker/50">
            <div class="pl-2 pr-4 py-2">
                <ConnectedList />
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
