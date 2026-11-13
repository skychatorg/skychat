import { useNow } from '@/composables/useNow';
import { serverNow } from '@/lib/serverClock';
import { computed, ref, toValue, watch } from 'vue';

/**
 * Seconds left until a server-given instant, and the full wait in ms, for a DrainBar
 */
export function useCountdown(deadline) {
    const now = useNow();
    // The full wait, taken when the deadline arrives
    const total = ref(1);
    watch(
        () => toValue(deadline),
        (at) => (total.value = Math.max(1, (at ?? 0) - serverNow())),
        { immediate: true },
    );
    const msLeft = computed(() => Math.max(0, (toValue(deadline) ?? 0) - now.value));
    return {
        seconds: computed(() => Math.ceil(msLeft.value / 1000)),
        total,
    };
}
