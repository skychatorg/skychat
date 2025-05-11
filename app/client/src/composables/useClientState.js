import { useClientStore } from '@/stores/client.js';
import { watch } from 'vue';

/**
 * @param {Function} callback What to do when the client state changes
 */
export function useClientState(callback) {
    const client = useClientStore();

    watch(() => client.state, callback, { deep: true });
}
