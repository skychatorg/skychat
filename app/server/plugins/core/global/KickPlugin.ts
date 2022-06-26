import {Connection} from "../../../skychat/Connection";
import {User} from "../../../skychat/User";
import {Session} from "../../../skychat/Session";
import { GlobalPlugin } from "../../GlobalPlugin";


/**
 * The kick plugin allows to force the disconnection of all the connections belonging to a session
 */
export class KickPlugin extends GlobalPlugin {

    static readonly commandName = 'kick';

    readonly minRight = 40;

    readonly rules = {
        kick: {
            minCount: 1,
            maxCount: 1,
            params: [{name: "username", pattern: User.USERNAME_REGEXP}]
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const identifier = param.toLowerCase();
        const session = Session.getSessionByIdentifier(identifier);
        if (! session) {
            throw new Error('Username not found');
        }
        for (const connection of session.connections) {
            connection.close(Connection.CLOSE_KICKED, "You have been kicked");
        }
    }
}
