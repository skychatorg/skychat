<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';

const app = useAppStore();
const client = useClientStore();

const CURSOR_POSITION_DELAY_MS = 150;

const lastSentDate = ref(new Date());

/**
 * Reference to the timeout that sends cursor position
 */
let timeout = null;

onMounted(() => {
    
    /**
     * Send cursor position
     */
    document.addEventListener('mousemove', event => {
        if (client.state.currentRoomId === null) {
            return;
        }
        const x = event.clientX / window.innerWidth;
        const y = event.clientY / window.innerHeight;
        sendCursorPosition(x, y);
    });
});

const sendCursorPosition = (x, y) => {
    
    const delay = new Date().getTime() - lastSentDate.value.getTime();
    if (delay < CURSOR_POSITION_DELAY_MS) {
        clearTimeout(timeout);
        timeout = setTimeout(() => sendCursorPosition(x, y), CURSOR_POSITION_DELAY_MS - delay);
        return;
    }
    client.sendMessage(`/c ${x} ${y}`);
    lastSentDate.value = new Date();
};

const cursorList = computed(() => Object.values(client.state.cursors));

</script>

<template>
    <div class="pointer-events-none fixed opacity-10">
        <div class="w-fit h-fit transition ease-out duration-200 relative"
            v-for="entry in cursorList"
            :key="entry.cursor.user.id"
            :style="{
                'transform': `translate(${entry.cursor.x * 100}vw, ${entry.cursor.y * 100}vh)`,
            }"
        >
            <fa
                icon="arrow-pointer"
                class="absolute top-0 left-0"
            />
            <UserMiniAvatar
                :user="entry.cursor.user"
                class="absolute top-4 left-3"
            />
        </div>
    </div>
</template>
