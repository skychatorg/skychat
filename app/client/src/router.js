import { createRouter, createWebHistory } from 'vue-router';
import { useToast } from 'vue-toastification';
import { SkyChatClient } from '../../api/index.ts';
import { useClientStore } from '@/stores/client';
import Home from '@/views/Home.vue';
import Chat from '@/views/Chat.vue';

export const roomRoute = (roomId, query = {}) => ({ name: 'room', params: { roomId: String(roomId) }, query });

// Whether the entry before this one is `to`: then going back undoes the step instead of stacking a new entry
export const cameFrom = (to) => window.history.state?.back === router.resolve(to).fullPath;

export const ROOM_REFUSED = 'That room doesn’t exist or isn’t open to you';

export const router = createRouter({
    history: createWebHistory(),
    routes: [
        { name: 'home', path: '/', component: Home },
        { name: 'room', path: '/room/:roomId(\\d+)', component: Chat },
        // Before the server says which room you are in. The chat view then replaces it with the room's URL
        { name: 'app', path: '/app', component: Chat },
        { path: '/:pathMatch(.*)*', redirect: { name: 'app' } },
    ],
});

router.beforeEach((to, from) => {
    const client = useClientStore();
    const inRoom = client.state.currentRoomId !== null;
    // Logged in users reconnect by themselves with this token. Guests have none, and go through the login page again
    const hasToken = Boolean(localStorage.getItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY));

    if (to.name === 'room') {
        // A room known to be closed: stay where you are. The room you are in is always fine, the room list may not have it yet (a new conversation)
        const roomId = Number(to.params.roomId);
        if (inRoom && roomId !== client.state.currentRoomId && !client.hasAccessToRoom(roomId)) {
            useToast().error(ROOM_REFUSED);
            // From the chat, cancel: URL and history untouched. From elsewhere (login redirect), there is nothing to stay on
            return from.name === 'room' ? false : { ...roomRoute(client.state.currentRoomId), replace: true };
        }
        // The server puts you back in this room when you connect, so a reload or a shared link opens it
        localStorage.setItem(SkyChatClient.LOCAL_STORAGE_ROOM_ID, to.params.roomId);
    }
    // Redirects replace the entry: going back through them must not stack more
    if (to.name === 'home') {
        // Logged in already: the login form has nothing to offer. Logging out leaves the room first
        if (inRoom) {
            return { ...roomRoute(client.state.currentRoomId), replace: true };
        }
        // About to reconnect with the saved login: wait on the connecting screen instead of flashing the form
        if (hasToken) {
            return { name: 'app', replace: true };
        }
        return true;
    }
    if (!inRoom && !hasToken) {
        return { name: 'home', query: to.name === 'room' ? { redirect: to.fullPath } : {}, replace: true };
    }
    return true;
});
