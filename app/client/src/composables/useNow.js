import { onUnmounted, ref } from 'vue';

/**
 * The current time, refreshed on an interval, for countdowns to a server-given instant
 */
export function useNow(intervalMs = 250) {
    const now = ref(Date.now());
    const timer = setInterval(() => (now.value = Date.now()), intervalMs);
    onUnmounted(() => clearInterval(timer));
    return now;
}
