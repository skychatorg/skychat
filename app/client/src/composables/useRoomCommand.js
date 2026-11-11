import { useClientStore } from '@/stores/client';
import { watch } from 'vue';

/**
 * Send a command that acts on the room you are in, to another room: go there first, and wait for the server
 * to confirm, since a command sent right after a join could be handled before it
 */
export function useRoomCommand() {
    const client = useClientStore();
    return (roomId, command) =>
        new Promise((resolve) => {
            if (client.state.currentRoomId === roomId) {
                client.sendMessage(command);
                resolve();
                return;
            }
            const stop = watch(
                () => client.state.currentRoomId,
                (id) => {
                    if (id === roomId) {
                        stop();
                        client.sendMessage(command);
                        resolve();
                    }
                },
            );
            client.join(roomId);
        });
}
