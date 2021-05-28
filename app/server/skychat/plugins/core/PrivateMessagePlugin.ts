import {Connection} from "../../Connection";
import {GlobalPlugin} from "../../GlobalPlugin";
import {Session} from "../../Session";
import {User} from "../../User";
import { Config } from "../../Config";


export class PrivateMessagePlugin extends GlobalPlugin {

    static readonly commandName = 'pm';

    readonly minRight = Config.PREFERENCES.minRightForPrivateMessages;

    readonly rules = {
        mp: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 1,
            params: [{name: 'username', pattern: User.USERNAME_REGEXP}]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const username = param.split(' ')[0];
        const session = Session.getSessionByIdentifier(Session.autocompleteIdentifier(username));
        if (! session) {
            throw new Error('User not found');
        }

        const privateRoom = this.manager.findPrivateRoom([connection.session.identifier, session.identifier]);
        if (privateRoom) {
            // make user join this room
            throw new Error('A private room already exists');
        }

        this.manager.createPrivateRoom([
            connection.session.identifier,
            session.identifier
        ]);
    }
}
