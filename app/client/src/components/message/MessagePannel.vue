<script setup>
import { watch, ref, nextTick } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import SingleMessage from '@/components/message/SingleMessage.vue';

const app = useAppStore();
const client = useClientStore();

const messagePannel = ref(null);

watch(() => client.messages, () => {
    // Wait for next tick for the message to be mounted into the DOM
    nextTick(() => {
        // Auto scroll message pannel to bottom
        messagePannel.value.scrollTop = messagePannel.value.scrollHeight;
    });
}, { deep: true });

</script>

<template>
    <div
        class="overflow-y-auto scroll-smooth pl-2 py-2 scrollbar "
        ref="messagePannel"
    >
        <SingleMessage
            v-for="message in client.messages"
            :key="message.id"
            :message="message"
        />
    </div>
</template>

<style scoped>
</style>
