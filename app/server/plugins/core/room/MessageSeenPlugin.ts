import {RoomPlugin} from "../../RoomPlugin";
import {Connection} from "../../../skychat/Connection";
import {UserController} from "../../../skychat/UserController";


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

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (connection.session.isGuest()) {
            return;
        }
        const lastMessageSeen = UserController.getPluginData(connection.session.user, this.commandName);
        const newLastMessageSeen = parseInt(param);
        const message = await this.room.getMessageById(newLastMessageSeen);
        if (! message) {
            return;
        }
        if (lastMessageSeen > newLastMessageSeen) {
            return;
        }
        let pluginData = UserController.getPluginData(connection.session.user, this.commandName);
        if (typeof pluginData !== 'object') {
            pluginData = {};
        }
        pluginData[this.room.id] = message.id;
        await UserController.savePluginData(connection.session.user, this.commandName, pluginData);
        this.room.send('message-seen', {
            user: connection.session.user.id,
            data: pluginData,
        } as MessageSeenEventData);
    }
}
