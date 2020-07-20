import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {Session} from "../../../Session";
import {User} from "../../../User";
import {ConnectedListPlugin} from "../core/ConnectedListPlugin";
import {UserController} from "../../../UserController";


export class GiveMoneyPlugin extends Plugin {

    public static readonly MIN_RIGHT_COMMISSION_FREE: number = 20;

    public static readonly COMMISSION_PERCENTAGE: number = 0.2;

    public static readonly COMMISSION_MIN: number = 1;

    readonly name = 'give';

    readonly minRight = 0;

    readonly rules = {
        give: {
            minCount: 2,
            maxCount: 2,
            coolDown: 100,
            params: [{name: 'username', pattern: User.USERNAME_REGEXP}, {name: 'amount', pattern: /^([0-9]+)$/}]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Get information about receiver, sender and amount
        const receiverUsername = param.split(' ')[0];
        const receiverSession = Session.getSessionByIdentifier(Session.autocompleteIdentifier(receiverUsername));
        if (! receiverSession) {
            throw new Error('User not found');
        }
        const totalAmount = parseInt(param.split(' ')[1]);
        const senderSession = connection.session;

        // Compute commission amount
        let commission = GiveMoneyPlugin.COMMISSION_MIN;
        if (Math.min(receiverSession.user.right, senderSession.user.right) < GiveMoneyPlugin.MIN_RIGHT_COMMISSION_FREE) {
            commission = Math.floor(Math.max(GiveMoneyPlugin.COMMISSION_MIN, GiveMoneyPlugin.COMMISSION_PERCENTAGE * totalAmount));
        }
        const givenAmount = totalAmount - commission;

        // If amount is zero substracting the commission
        if (givenAmount <= 0) {
            throw new Error('Given amount is zero');
        }

        // Actually transfer the money
        await UserController.buy(senderSession.user, totalAmount);
        await UserController.giveMoney(receiverSession.user, givenAmount);

        // Notify the receiver & sender
        this.room.send('give', {sender: senderSession.user.sanitized(), receiver: receiverSession.user.sanitized(), givenAmount: givenAmount, commission: commission});
        let message = senderSession.user.username + ' sent $' + givenAmount / 100 + ' to ' + receiverSession.user.username;
        if (commission > 0) {
            message += ' (- $' + (commission / 100) + ' commission)';
        }
        await this.room.sendMessage({content: message, user: UserController.getNeutralUser()});
        await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
