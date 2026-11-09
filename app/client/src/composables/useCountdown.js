import { useNow } from '@/composables/useNow';
import { computed, ref, toValue, watch } from 'vue';

/**
 * Seconds left until a server-given instant, and the full wait in ms. A bar drains over `total` with one CSS animation keyed on
 * the deadline: nudging it on every tick made it jump back in Firefox
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
        total,
    };
}
