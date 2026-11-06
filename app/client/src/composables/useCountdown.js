import { useNow } from '@/composables/useNow';
import { computed, ref, toValue, watch } from 'vue';

/**
 * Seconds left until a server-given instant, and the share of the wait still to go, for a bar.
 * Both read the same clock, so a bar and its countdown never disagree
 */
export function useCountdown(deadline) {
    const now = useNow();
    // The full wait, taken when the deadline arrives
    const total = ref(1);
    watch(
        () => toValue(deadline),
        (at) => (total.value = Math.max(1, (at ?? 0) - Date.now())),
        { immediate: true },
    );
    const msLeft = computed(() => Math.max(0, (toValue(deadline) ?? 0) - now.value));
    return {
        seconds: computed(() => Math.ceil(msLeft.value / 1000)),
        fraction: computed(() => Math.min(1, msLeft.value / total.value)),
    };
}
