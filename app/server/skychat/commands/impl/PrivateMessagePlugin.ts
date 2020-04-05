import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {Session} from "../../Session";
import {User} from "../../User";
import {Message} from "../../Message";


export class PrivateMessagePlugin extends Plugin {

    readonly name = 'mp';

    readonly aliases = ['pm'];

    readonly minRight = -1;

    readonly rules = {
        minCount: 2,
        coolDown: 50,
        params: [{name: 'username', pattern: User.USERNAME_REGEXP}]
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const username = param.split(' ')[0];
        const session = Session.getSessionByIdentifier(Session.autocompleteIdentifier(username));
        if (! session) {
            throw new Error('User not found');
        }

        session.send('message', new Message(param.split(' ').slice(1).join(' '), connection.session.user));
    }
}
