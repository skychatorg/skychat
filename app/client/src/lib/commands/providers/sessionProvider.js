import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useClientStore } from '@/stores/client';
import { labels } from '../labels';

export function useSessionCommands() {
    const client = useClientStore();
    const route = useRoute();
    const router = useRouter();

    return computed(() => {
        /** @type {import('../types.js').Command[]} */
        const out = [];
        const loggedIn = (client.state.user?.right ?? -1) >= 0;

        // Guests log out too: it is their way back to the login form
        if (loggedIn || client.state.currentRoomId !== null) {
            out.push({
                id: 'session.logout',
                title: labels.logout(),
                icon: 'power-off',
                category: 'Session',
                keywords: ['sign out', 'leave'],
                run: () => {
                    client.logout();
                    router.push({ name: 'home' });
                },
            });
        }

        if (!loggedIn && route?.name === 'home') {
            out.push({
                id: 'session.guest',
                title: labels.loginAsGuest(),
                icon: 'user',
                category: 'Session',
                keywords: ['anonymous'],
                run: () => client.authAsGuest(),
            });
        }

        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            out.push({
                id: 'session.notifications',
                title: labels.requestNotifPermission(),
                icon: 'bell',
                category: 'Session',
                keywords: ['notifications', 'permission', 'alerts'],
                run: () => Notification.requestPermission(),
            });
        }

        return out;
    });
}
