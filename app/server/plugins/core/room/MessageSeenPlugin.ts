import { RoomPlugin } from '../../RoomPlugin';
import { Connection } from '../../../skychat/Connection';
import { UserController } from '../../../skychat/UserController';


export type MessageSeenEventData = {
    user: number;
    data: {[room: number]: number};
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
            maxCount: 1,
            maxCallsPer10Seconds: 40,
            params: [
                {
                    name: 'message id',
                    pattern: /^[0-9]+$/,
                    info: 'Id of the last seen message'
                }
            ]
        }
    };

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        if (connection.session.isGuest()) {
            return;
        }
        // Parse new last message seen id
        const newLastMessageSeen = parseInt(param);
        const message = await this.room.getMessageById(newLastMessageSeen);
        if (! message) {
            return;
        }
        // Load previous data from the plugin storage. An object mapping room ids to last message seen.
        let pluginData = UserController.getUserPluginData<{[roomId: number]: number}>(connection.session.user, this.commandName);
        if (typeof pluginData !== 'object') {
            pluginData = {};
        }
        // Clean plugin data to only reflect rooms that still exists
        for (const roomId in pluginData) {
            if (! this.room.manager.getRoomById(parseInt(roomId))) {
                delete pluginData[roomId];
            }
        }
        // Check that the new last message seen id is greater than the previous one
        if (newLastMessageSeen <= pluginData[this.room.id]) {
            return;
        }
        // Update plugin data
        pluginData[this.room.id] = message.id;
        // Save plugin data with the new last message seen id
        await UserController.savePluginData(connection.session.user, this.commandName, pluginData);
        // Send update to other in this room
        this.room.send('message-seen', {
            user: connection.session.user.id,
            data: pluginData,
        } as MessageSeenEventData);
    }
}
