<script setup>
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed, onMounted, ref } from 'vue';

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
    document.addEventListener('mousemove', (event) => {
        if (client.state.currentRoomId === null) {
            return;
        }
        const x = event.clientX / window.innerWidth;
        const y = event.clientY / window.innerHeight;
        sendCursorPosition(x, y);
    });
});

const sendCursorPosition = (x, y) => {
    if (x < 0 || x > 1 || y < 0 || y > 1) {
        return;
    }
    const delay = new Date().getTime() - lastSentDate.value.getTime();
    if (delay < CURSOR_POSITION_DELAY_MS) {
        clearTimeout(timeout);
        timeout = setTimeout(() => sendCursorPosition(x, y), CURSOR_POSITION_DELAY_MS - delay);
        return;
    }
    client.sendCursorPosition(x, y);
    lastSentDate.value = new Date();
};

const cursorList = computed(() => Object.values(client.state.cursors));

function getEasterDate(year) {
    const f = Math.floor;
    const G = year % 19;
    const C = f(year / 100);
    const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
    const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
    const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
    const L = I - J;
    const month = 3 + f((L + 40) / 44);
    const day = L + 28 - 31 * f(month / 4);
    return new Date(year, month - 1, day);
}

const isEaster = computed(() => {
    /**
     * Return whether today is Easter's weekend or not
     */
    const today = new Date();
    const easterSunday = getEasterDate(today.getFullYear());

    const easterSaturday = new Date(easterSunday);
    easterSaturday.setDate(easterSunday.getDate() - 1);

    const easterMonday = new Date(easterSunday);
    easterMonday.setDate(easterSunday.getDate() + 1);

    const sameDay = (a, b) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    return sameDay(today, easterSaturday) || sameDay(today, easterSunday) || sameDay(today, easterMonday);
});
</script>

<template>
    <div class="pointer-events-none fixed opacity-25 z-10">
        <div
            v-for="entry in cursorList"
            :key="entry.cursor.user.id"
            class="w-fit h-fit transition duration-200 relative"
            :style="{
                transform: `translate(${entry.cursor.x * 100}vw, ${entry.cursor.y * 100}vh)`,
            }"
        >
            <template v-if="isEaster">
                <fa icon="fa-solid fa-egg" class="absolute top-0 left-0 text-primary text-4xl" />
            </template>
            <template v-else>
                <fa icon="arrow-pointer" class="absolute top-0 left-0 text-primary" />
                <UserMiniAvatar :user="entry.cursor.user" class="absolute top-4 left-3" />
            </template>
        </div>
    </div>
</template>
