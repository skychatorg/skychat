<script setup>
import MessagePannel from '@/components/message/MessagePannel.vue';
import NewMessageForm from '@/components/message/NewMessageForm.vue';
import PlayerPannel from '@/components/player/PlayerPannel.vue';
import PlayerChannelList from '@/components/playerchannel/PlayerChannelList.vue';
import PollList from '@/components/poll/PollList.vue';
import RoomHeader from '@/components/room/RoomHeader.vue';
import RoomList from '@/components/room/RoomList.vue';
import ConnectedList from '@/components/user/ConnectedList.vue';
import { useUserRight } from '@/composables/useUserRight';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed, ref } from 'vue';

const app = useAppStore();
const client = useClientStore();

const query = ref('');

const canSearchMessages = useUserRight('minRightForMessageHistory', -1);

const currentRoomName = computed(() => client.state.currentRoom?.name ?? 'this room');

const runSearch = () => {
    const sanitizedQuery = query.value.trim();
    if (!sanitizedQuery) {
        return;
    }
    client.searchMessages(sanitizedQuery);
};

const clearSearch = () => {
    query.value = '';
    client.clearMessageSearch();
};
</script>

<template>
    <div class="chat-view relative h-0 flex flex-row grow">
        <!-- Left column -->
        <aside
            class="h-full flex flex-col w-full lg:flex lg:w-[var(--page-col-left-width)] hairline backdrop-blur-xl"
            :class="{ hidden: app.mobileView !== 'left' }"
            :style="{ background: 'var(--surface)' }"
            aria-label="Rooms and channels"
        >
            <RoomList class="flex-grow min-h-0" />
            <PlayerChannelList />
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
        </aside>

        <!-- Middle column -->
        <main
            class="w-0 grow h-full flex flex-col lg:flex"
            :class="{ hidden: app.mobileView !== 'middle' }"
            :style="{ background: 'rgba(8, 8, 18, 0.35)' }"
        >
            <PlayerPannel v-if="client.state.currentPlayerChannel" />
            <RoomHeader v-if="client.state.currentRoom" :room="client.state.currentRoom" />
            <PollList />
            <div v-if="canSearchMessages" class="px-3 py-1 flex justify-end">
                <form class="flex gap-1.5 items-center text-sm" @submit.prevent="runSearch">
                    <button
                        v-if="client.messageSearch.query || client.messageSearchLoading"
                        type="button"
                        class="form-control flex items-center justify-center gap-1.5 py-2 px-4 whitespace-nowrap"
                        @click="clearSearch"
                    >
                        <fa icon="times" />
                        <span>Clear</span>
                    </button>
                    <input v-model="query" type="text" class="form-control w-64 py-2 px-3" :placeholder="`Search in ${currentRoomName}`" />
                    <button type="submit" class="form-control flex items-center justify-center gap-1.5 py-2 px-4 whitespace-nowrap">
                        <fa icon="magnifying-glass" />
                        <span>Search</span>
                    </button>
                </form>
            </div>
            <MessagePannel class="grow min-h-0" />
            <NewMessageForm />
        </main>

        <!-- Right column -->
        <aside
            class="h-full flex flex-col w-full lg:flex lg:w-[var(--page-col-right-width)] hairline backdrop-blur-xl"
            :class="{ hidden: app.mobileView !== 'right' }"
            :style="{ background: 'var(--surface)' }"
            aria-label="Connected users"
        >
            <ConnectedList class="flex-grow min-h-0" />
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
        </aside>
    </div>
</template>

<style scoped>
.chat-view {
    width: 100%;
    max-width: var(--page-max-width);
    margin: 0 auto;
}
</style>
