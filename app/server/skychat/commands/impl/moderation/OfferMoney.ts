import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {Session} from "../../../Session";
import {User} from "../../../User";
import {Message} from "../../../Message";
import {ConnectedListPlugin} from "../core/ConnectedListPlugin";
import {UserController} from "../../../UserController";


export class OfferMoney extends Plugin {

    readonly name = 'offermoney';

    readonly minRight = 0;

    readonly opOnly = true;

    readonly rules = {
        offermoney: {
            minCount: 2,
            maxCount: 2,
            coolDown: 50,
            params: [{name: 'username', pattern: User.USERNAME_REGEXP}, {name: 'amount', pattern: /^([0-9]+)$/}]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const username = param.split(' ')[0];
        const session = Session.getSessionByIdentifier(Session.autocompleteIdentifier(username));
        if (! session) {
            throw new Error('User not found');
        }

        const amount = parseInt(param.split(' ')[1]);
        await UserController.giveMoney(session.user, amount);
        session.send('message', new Message(connection.session.user.username + ' sent you $ ' + amount / 100, null, UserController.getNeutralUser()).sanitized());
        await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
