import {Plugin} from "../../Plugin";
import {Connection} from "../../../Connection";
import {UserController} from "../../../UserController";


export type MessageSeenEventData = {
    user: number;
    message: number;
};

export class MessageSeenPlugin extends Plugin {

    readonly name = 'lastseen';

    readonly defaultDataStorageValue = 0;

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
            maxCallsPer10Seconds: 20,
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
        const lastMessageSeen = UserController.getPluginData(connection.session.user, this.name);
        const newLastMessageSeen = parseInt(param);
        const message = await this.room.getMessageById(newLastMessageSeen);
        if (! message) {
            return;
        }
        if (lastMessageSeen > newLastMessageSeen) {
            return;
        }
        await UserController.savePluginData(connection.session.user, this.name, message.id);
        this.room.send('message-seen', {user: connection.session.user.id, message: message.id} as MessageSeenEventData);
    }
}
