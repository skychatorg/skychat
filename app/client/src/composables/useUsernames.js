import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

/** What the server accepts as a username */
export const isUsername = (text) => /^[a-z0-9-_]+$/i.test(text.trim());

/**
 * The names in the user list, for a field's suggestions. Guests left out with `accountsOnly`
 */
export function useUsernames({ accountsOnly = false } = {}) {
    const client = useClientStore();
    return computed(() =>
        (client.state.connectedList ?? [])
            .map((entry) => entry.user)
            .filter((user) => !accountsOnly || user.right >= 0)
            .map((user) => user.username),
    );
}
