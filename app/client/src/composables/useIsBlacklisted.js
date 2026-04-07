import { computed } from 'vue';
import { useClientStore } from '@/stores/client.js';

/**
 * @param {() => { username: string, id: number }} getUser Function returning the user to check
 * @returns {import('vue').ComputedRef<boolean>}
 */
export function useIsBlacklisted(getUser) {
    const client = useClientStore();

    return computed(() => {
        if (!client.state.user) {
            return false;
        }
        const blacklist = client.state.user.data.plugins.blacklist;
        if (!blacklist) {
            return false;
        }
        const user = getUser();
        // Handle both legacy (array) and new (object) formats
        if (Array.isArray(blacklist)) {
            return blacklist.includes(user.username.toLowerCase());
        }
        if (user.id === 0 && blacklist.guests) {
            return true;
        }
        return (blacklist.users || []).includes(user.username.toLowerCase());
    });
}
