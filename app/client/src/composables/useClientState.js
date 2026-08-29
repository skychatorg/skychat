import { useClientStore } from '@/stores/client.js';
import { watch } from 'vue';

/**
 * Run `callback` when the logged-in user's data or the room list changes. Both are what the
 * client's `hasUnreadMessages` / mute helpers read.
 *
 * Deliberately not a deep watch on the whole client state: that re-traverses every connected user
 * and every message map on each server event, once per subscribed component.
 */
export function useClientState(callback) {
    const client = useClientStore();

    watch([() => client.state.user, () => client.state.rooms], callback);
}
