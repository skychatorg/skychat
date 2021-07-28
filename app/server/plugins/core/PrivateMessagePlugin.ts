import {Connection} from "../../skychat/Connection";
import {GlobalPlugin} from "../GlobalPlugin";
import {Session} from "../../skychat/Session";
import {User} from "../../skychat/User";
import { Config } from "../../skychat/Config";


export class PrivateMessagePlugin extends GlobalPlugin {

    static readonly commandName = 'pm';

    readonly minRight = Config.PREFERENCES.minRightForPrivateMessages;

    readonly rules = {
        pm: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 1,
            params: [{name: 'username', pattern: User.USERNAME_REGEXP}]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const username = param.split(' ')[0];
        const session = Session.getSessionByIdentifier(username);
        if (! session) {
            throw new Error('User not found');
        }

        if (session.identifier === connection.session.identifier) {
            throw new Error('Can not start a private room with yourself');
        }

        const privateRoom = this.manager.findPrivateRoom([connection.session.identifier, session.identifier]);
        if (privateRoom) {
            // make user join this room
            await privateRoom.attachConnection(connection);
            return;
        }

        this.manager.createPrivateRoom([
            connection.session.identifier,
            session.identifier
        ]);
    }
}
