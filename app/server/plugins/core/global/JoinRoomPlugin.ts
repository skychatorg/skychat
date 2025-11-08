import { ConnectionAcceptedEvent } from '../../../skychat/AuthBridge.js';
import { Connection } from '../../../skychat/Connection.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export class JoinRoomPlugin extends GlobalPlugin {
    static readonly CHANGE_USERNAME_PRICE = 2000;

    static readonly commandName = 'join';

    readonly minRight = -1;

    readonly rules = {
        join: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{ name: 'roomId', pattern: /^(\d+)$/ }],
        },
    };

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        try {
            // Validate the room id
            const roomId = parseInt(param, 10);
            if (typeof roomId !== 'number') {
                throw new Error('Invalid room specified');
            }

            // Ensure room exists
            const room = this.manager.getRoomById(roomId);
            if (!room) {
                throw new Error('Invalid room specified');
            }

            // Ensure user is allowed to join the room
            if (room.isPrivate) {
                if (!room.whitelist.includes(connection.session.identifier)) {
                    throw new Error('You are not allowed to join this room');
                }
            }

            // Join the room
            await room.attachConnection(connection);
        } catch (error) {
            connection.send('join-room', connection.room?.id ?? null);
            throw error;
        }
    }

    async joinRoom(connection: Connection, roomId: number) {
        // Ensure room exists
        const room = this.manager.getRoomById(roomId);
        if (!room) {
            throw new Error('Invalid room specified');
        }

        // Ensure user is allowed to join the room
        if (room.isPrivate) {
            if (!room.whitelist.includes(connection.session.identifier)) {
                throw new Error('You are not allowed to join this room');
            }
        }

        // Join the room
        await room.attachConnection(connection);
    }

    async onNewConnection(connection: Connection, event: ConnectionAcceptedEvent) {
        // Try to join the room specified in the event data
        let savedRoomId: number | undefined = undefined;
        if (typeof event.data.roomId === 'number') {
            const room = this.manager.getRoomById(event.data.roomId);
            if (room && room.accepts(connection.session)) {
                savedRoomId = event.data.roomId;
            }
        }

        // Try to join any room
        const anyRoom = this.manager.findSuitableRoom(connection);
        if (!anyRoom) {
            throw new Error('No room found. Is the server correctly configured?');
        }

        await this.joinRoom(connection, savedRoomId ?? anyRoom.id);
    }
}
