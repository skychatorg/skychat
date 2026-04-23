import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { apiClient, useClientStore } from '@/stores/client';
import { labels } from '../labels';

function roomLabel(room, client) {
    if (room.isPrivate) {
        if (room.name) return room.name;
        const others = (room.whitelist || []).filter((id) => client.state.user?.username.toLowerCase() !== id);
        return others.length ? `@${others.join(', @')}` : `Archive`;
    }
    return room.name || `Room #${room.id}`;
}

export function useRoomCommands() {
    const client = useClientStore();
    const app = useAppStore();

    return computed(() => {
        /** @type {import('../types.js').Command[]} */
        const out = [];
        const rooms = client.state.rooms || [];
        const currentId = client.state.currentRoomId;

        for (const room of rooms) {
            const name = roomLabel(room, client);
            const subtitle = `Room #${room.id}`;
            const isCurrent = room.id === currentId;
            const isMuted = apiClient.plugins?.mute?.isRoomMuted?.(room.id) ?? false;

            if (!isCurrent) {
                out.push({
                    id: `room.join.${room.id}`,
                    title: labels.joinRoom(name),
                    subtitle,
                    icon: 'hashtag',
                    category: 'Rooms',
                    keywords: ['switch', 'open'],
                    run: () => client.join(room.id),
                });
            }

            if (room.lastReceivedMessageId) {
                out.push({
                    id: `room.read.${room.id}`,
                    title: labels.markRoomRead(name),
                    subtitle,
                    icon: 'circle-dot',
                    category: 'Rooms',
                    keywords: ['seen', 'unread'],
                    run: () => client.sendMessage(`/lastseen ${room.lastReceivedMessageId}`),
                });
            }

            out.push({
                id: `room.mute.${room.id}`,
                title: isMuted ? labels.unmuteRoom(name) : labels.muteRoom(name),
                subtitle,
                icon: isMuted ? 'volume-xmark' : 'bell',
                category: 'Rooms',
                keywords: ['silence', 'notifications'],
                run: () => client.sendMessage(`${isMuted ? '/unmute' : '/mute'} ${room.id}`),
            });

            out.push({
                id: `room.copyid.${room.id}`,
                title: labels.copyRoomId(name),
                subtitle,
                icon: 'copy',
                category: 'Rooms',
                run: () => navigator.clipboard.writeText(room.id.toString()),
            });
        }

        if (rooms.length > 1) {
            out.push({
                id: 'room.next',
                title: labels.nextRoom(),
                icon: 'chevron-down',
                category: 'Rooms',
                shortcut: 'Alt+↓',
                run: () => {
                    const idx = rooms.findIndex((r) => r.id === currentId);
                    const next = rooms[(idx + 1) % rooms.length];
                    if (next) client.join(next.id);
                },
            });
            out.push({
                id: 'room.prev',
                title: labels.previousRoom(),
                icon: 'chevron-up',
                category: 'Rooms',
                shortcut: 'Alt+↑',
                run: () => {
                    const idx = rooms.findIndex((r) => r.id === currentId);
                    const prev = rooms[(idx - 1 + rooms.length) % rooms.length];
                    if (prev) client.join(prev.id);
                },
            });
        }

        if (client.state.op) {
            out.push({
                id: 'room.manage',
                title: labels.manageRooms(),
                icon: 'gears',
                category: 'Rooms',
                keywords: ['admin', 'create room', 'edit room'],
                run: () => app.toggleModal('manageRooms'),
            });
        }

        return out;
    });
}
