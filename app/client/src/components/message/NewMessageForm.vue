<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';

const app = useAppStore();
const client = useClientStore();

let typingListStr = computed(() => {

    if (client.state.typingList.length === 0) {
        return '';
    }

    if (client.state.typingList.length === 1) {
        return `${client.state.typingList[0].username} is typing..`;
    }

    if (client.state.typingList.length <= 3) {
        const usernames = client.state.typingList.map(user => user.username);
        return `${usernames.join(', ')} are typing..`;
    }

    return `multiple users are currently typing..`;
});

</script>

<template>
    <div class="pt-2 pb-4 px-4">
        <!-- Typing list -->
        <p class="h-5 pl-4 pb-1 text-xs">
            {{ typingListStr }}
        </p>
        <!-- New message form -->
        <div class="flex">

            <!-- New message input -->
            <input
                class="form-control grow"
                type="text"
                :placeholder="'New message / ' + client.state.currentRoom.name"
                v-bind:value="app.newMessage"
                v-on:input="app.newMessage = $event.target.value"
                @keydown.enter="app.sendMessage"
            />

            <!-- Send button -->
            <button class="form-control ml-2">
                <fa icon="paper-plane" />
            </button>
        </div>
    </div>
</template>

<style scoped>
</style>
