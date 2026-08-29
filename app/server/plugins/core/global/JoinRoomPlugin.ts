import { ConnectionAcceptedEvent } from '../../../skychat/AuthBridge.js';
import { Connection } from '../../../skychat/Connection.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { MessageHistoryPlugin } from '../room/MessageHistoryPlugin.js';

export class JoinRoomPlugin extends GlobalPlugin {
    static readonly CHANGE_USERNAME_PRICE = 2000;

    static readonly commandName = 'join';

    readonly minRight = -1;

    readonly rules = {
        join: {
            minCount: 1,
            maxCount: 1,
            // Limit is per IP, and clicking through a room list burns it fast
            maxCallsPer10Seconds: 40,
            params: [{ name: 'roomId', pattern: /^(\d+)$/ }],
        },
    };

    /**
     * The client switches rooms optimistically and drops the messages it was showing, so any rejected
     * /join (rate limit, missing right, unknown room) must restore both the room it is actually in and
     * that room's history. `check()` throws before `run()`, hence the resync lives here, not in run().
     */
    async execute(alias: string, param: string, connection: Connection): Promise<void> {
        try {
            await super.execute(alias, param, connection);
        } catch (error) {
            connection.send('join-room', connection.roomId);
            connection.room?.getPlugin<MessageHistoryPlugin>(MessageHistoryPlugin.commandName)?.sendInitialHistory(connection);
            throw error;
        }
    }

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        await this.joinRoom(connection, parseInt(param, 10));
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
