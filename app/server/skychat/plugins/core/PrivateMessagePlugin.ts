import {Connection} from "../../Connection";
import {GlobalPlugin} from "../../GlobalPlugin";
import {Session} from "../../Session";
import {User} from "../../User";
import {PrivateMessage} from "../../PrivateMessage";
import { Config } from "../../Config";


export class PrivateMessagePlugin extends GlobalPlugin {

    static readonly commandName = 'mp';

    readonly minRight = Config.PREFERENCES.minRightForPrivateMessages;

    readonly rules = {
        mp: {
            minCount: 1,
            maxCount: 1,
            coolDown: 50,
            params: [{name: 'username', pattern: User.USERNAME_REGEXP}]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const username = param.split(' ')[0];
        const session = Session.getSessionByIdentifier(Session.autocompleteIdentifier(username));
        if (! session) {
            throw new Error('User not found');
        }

        this.manager.createPrivateRoom([
            connection.session.identifier,
            session.identifier
        ]);
    }
}
