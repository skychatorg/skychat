import { serverNow } from '@/lib/serverClock';
import { onUnmounted, ref } from 'vue';

/**
 * The server's current time, refreshed on an interval, for countdowns to a server-given instant
 */
export function useNow(intervalMs = 250) {
    const now = ref(serverNow());
    const timer = setInterval(() => (now.value = serverNow()), intervalMs);
    onUnmounted(() => clearInterval(timer));
    return now;
}
