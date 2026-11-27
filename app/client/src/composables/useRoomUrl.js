import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { cameFrom, ROOM_REFUSED, roomRoute } from '@/router.js';
import { useClientStore } from '@/stores/client';

/**
 * Keeps the URL and the current room in step, so back and forward walk the rooms you visited
 * - URL changed (back, forward, a link): join that room
 * - Room changed (a click, a shortcut, a /pm, the server moving you): push its URL
 */
export function useRoomUrl() {
    const route = useRoute();
    const router = useRouter();
    const client = useClientStore();
    const toast = useToast();
    const urlShows = (roomId) => route.name === 'room' && route.params.roomId === String(roomId);

    // Set once the first room after loading the page is in the URL. Before that the server picks the room from the URL itself
    let landed = false;
    // The current room's messages arrived. Switching again before that replaces the entry instead of stacking one: a held shortcut on a slow link
    let settled = true;
    watch(
        () => client.state.currentRoomReady,
        (ready) => (settled ||= ready),
    );

    watch(
        () => route.params.roomId,
        (param) => {
            const roomId = Number(param);
            const currentRoomId = client.state.currentRoomId;
            // The router already refused rooms known to be closed
            if (route.name !== 'room' || roomId === currentRoomId || !landed) {
                return;
            }
            // Also while disconnected: the client reconnects into the room it last asked for
            client.join(roomId);
        },
    );

    watch(
        () => client.state.currentRoomId,
        async (roomId) => {
            if (roomId === null) {
                return;
            }
            const firstLanding = !landed;
            landed = true;
            if (urlShows(roomId)) {
                return;
            }
            // The server refused the room we just pushed (it says why): drop that entry rather than stacking a second one
            if (client.state.joinRefused && cameFrom(roomRoute(roomId))) {
                router.back();
                return;
            }
            // Not a move the user made: landing after a reload or a link (query kept, an open profile)
            if (firstLanding || route.name !== 'room' || client.state.joinRefused) {
                if (firstLanding && route.name === 'room' && Number(route.params.roomId) !== roomId) {
                    toast.error(ROOM_REFUSED);
                }
                router.replace(roomRoute(roomId, firstLanding ? route.query : {}));
                return;
            }
            // A profile belongs to the room it was opened in: back must not reopen it
            if (route.query.user) {
                const withoutProfile = { query: { ...route.query, user: undefined } };
                // Opened here: its entry becomes the new room. Opened from a link: keep the room under it
                if (cameFrom(withoutProfile)) {
                    router.replace(roomRoute(roomId));
                    return;
                }
                await router.replace(withoutProfile);
            }
            const replace = !settled;
            settled = false;
            router.push({ ...roomRoute(roomId), replace });
        },
        { immediate: true },
    );
}
