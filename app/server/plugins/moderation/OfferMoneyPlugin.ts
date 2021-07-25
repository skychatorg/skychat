import {Connection} from "../../skychat/Connection";
import {GlobalPlugin} from "../GlobalPlugin";
import {Session} from "../../skychat/Session";
import {User} from "../../skychat/User";
import {ConnectedListPlugin} from "../core/ConnectedListPlugin";
import {UserController} from "../../skychat/UserController";


export class OfferMoneyPlugin extends GlobalPlugin {

    static readonly commandName = 'offermoney';

    readonly minRight = 0;

    readonly opOnly = true;

    readonly rules = {
        offermoney: {
            minCount: 2,
            maxCount: 2,
            coolDown: 50,
            params: [{name: 'username', pattern: User.USERNAME_LOGGED_REGEXP}, {name: 'amount', pattern: /^([0-9]+)$/}]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const identifier = param.split(' ')[0].toLowerCase();
        const session = Session.getSessionByIdentifier(identifier);
        if (! session) {
            throw new Error('User not found');
        }

        const amount = parseInt(param.split(' ')[1]);
        await UserController.giveMoney(session.user, amount);
        session.send('message', UserController.createNeutralMessage({
            content: connection.session.user.username + ' sent you $ ' + amount / 100,
            room: connection.roomId,
            id: 0
        }).sanitized());
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
