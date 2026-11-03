import { useRoute, useRouter } from 'vue-router';
import { cameFrom } from '@/router.js';

/**
 * A user's profile lives in the URL (?user=name): it can be linked, survives a reload, and back closes it
 */
export function useUserProfile() {
    const route = useRoute();
    const router = useRouter();

    const openProfile = (username) => router.push({ query: { ...route.query, user: username } });

    const closeProfile = () => {
        const query = { ...route.query };
        delete query.user;
        // Opened from the app: going back is closing it. Opened from a link: there is nothing to go back to
        if (cameFrom({ query })) {
            router.back();
        } else {
            router.replace({ query });
        }
    };

    return { openProfile, closeProfile };
}
