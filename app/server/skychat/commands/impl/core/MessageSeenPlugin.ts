import {Plugin} from "../../Plugin";
import {Connection} from "../../../Connection";
import {UserController} from "../../../UserController";


export class MessageSeenPlugin extends Plugin {

    readonly name = 'lastseen';

    readonly defaultDataStorageValue = 0;

    readonly minRight = 0;

    readonly rules = {
        s: {
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
        const lastMessageSeen = UserController.getPluginData(connection.session.user, this.name);
        const newLastMessageSeen = parseInt(param);
        const message = this.room.getMessageById(newLastMessageSeen);
        if (! message) {
            return;
        }
        if (lastMessageSeen > newLastMessageSeen) {
            return;
        }
        await UserController.savePluginData(connection.session.user, this.name, message.id);
        //await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
