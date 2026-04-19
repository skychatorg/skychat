import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

/**
 * Reactive permission check against `client.state.config[configKey]`.
 * Threshold can be the sentinel string `'op'` (op-only) or a numeric right level.
 */
export function useUserRight(configKey, defaultThreshold = 'op') {
    const client = useClientStore();
    return computed(() => {
        const threshold = client.state.config?.[configKey] ?? defaultThreshold;
        if (threshold === 'op') {
            return client.state.op;
        }
        const userRight = client.state.user?.right ?? -1;
        return client.state.op || userRight >= threshold;
    });
}
