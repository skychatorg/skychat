import { Connection } from '../../../skychat/Connection.js';
import { UserController } from '../../../skychat/UserController.js';
import { RoomPlugin } from '../../RoomPlugin.js';

export type MessageSeenEventData = {
    user: number;
    data: { [room: number]: number };
};

export class MessageSeenPlugin extends RoomPlugin {
    static readonly commandName = 'lastseen';

    static readonly defaultDataStorageValue = {};

    /**
     * We need to allow guests to send /lastseen even though it is not recorded in the backend because sometimes,
     *  the client does not know it own right level, therefore it would always send /lastseen
     */
    readonly minRight = -1;

    readonly hidden = true;

    readonly rules = {
        lastseen: {
            minCount: 1,
            maxCount: 2,
            maxCallsPer10Seconds: 40,
            params: [
                {
                    name: 'message id',
                    pattern: /^[0-9]+$/,
                    info: 'Id of the last seen message',
                },
                {
                    name: 'room id',
                    pattern: /^[0-9]+$/,
                    info: 'Room the message belongs to. Defaults to the room the command was sent from.',
                },
            ],
        },
    };

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        if (connection.session.user.isGuest()) {
            return;
        }
        // The room list lets you mark a room you are not in as read, hence the explicit room id
        const [messageIdParam, roomIdParam] = param.split(' ');
        const room = roomIdParam ? this.room.manager.getRoomById(parseInt(roomIdParam)) : this.room;
        if (!room || !room.accepts(connection.session)) {
            return;
        }
        // Parse new last message seen id
        const newLastMessageSeen = parseInt(messageIdParam);
        const message = room.getMessageById(newLastMessageSeen);
        if (!message) {
            return;
        }
        // Load previous data from the plugin storage. An object mapping room ids to last message seen.
        let pluginData = UserController.getUserPluginData<{ [roomId: number]: number }>(connection.session.user, this.commandName);
        if (typeof pluginData !== 'object') {
            pluginData = {};
        }
        // Clean plugin data to only reflect rooms that still exists
        for (const roomId in pluginData) {
            if (!this.room.manager.getRoomById(parseInt(roomId))) {
                delete pluginData[roomId];
            }
        }
        // Check that the new last message seen id is greater than the previous one
        if (newLastMessageSeen <= pluginData[room.id]) {
            return;
        }
        // Update plugin data
        pluginData[room.id] = message.id;
        // Save plugin data with the new last message seen id
        await UserController.savePluginData(connection.session.user, this.commandName, pluginData);
        const event = { user: connection.session.user.id, data: pluginData } as MessageSeenEventData;
        // Send update to others in the room the message belongs to
        room.send('message-seen', event);
        // The sender is elsewhere and would otherwise miss its own read receipt
        if (room !== this.room) {
            connection.session.send('message-seen', event);
        }
    }
}
