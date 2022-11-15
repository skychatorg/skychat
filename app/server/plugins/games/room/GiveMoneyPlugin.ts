import { Connection } from '../../../skychat/Connection';
import { RoomPlugin } from '../../RoomPlugin';
import { Session } from '../../../skychat/Session';
import { User } from '../../../skychat/User';
import { ConnectedListPlugin } from '../../core/global/ConnectedListPlugin';
import { UserController } from '../../../skychat/UserController';


export class GiveMoneyPlugin extends RoomPlugin {

    public static readonly COMMISSION_PERCENTAGE: number = 0.2;

    public static readonly COMMISSION_MIN: number = 1;

    static readonly commandName = 'give';

    readonly minRight = 0;

    readonly rules = {
        give: {
            minCount: 2,
            maxCount: 2,
            coolDown: 100,
            params: [{ name: 'username', pattern: User.USERNAME_REGEXP }, { name: 'amount', pattern: /^([0-9]+)$/ }]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Get information about receiver, sender and amount
        const receiverUsername = param.split(' ')[0];
        const receiverSession = Session.getSessionByIdentifier(receiverUsername);
        if (! receiverSession) {
            throw new Error('User not found');
        }
        const totalAmount = parseInt(param.split(' ')[1]);
        const senderSession = connection.session;

        // Compute commission amount
        const commission = Math.floor(Math.max(GiveMoneyPlugin.COMMISSION_MIN, GiveMoneyPlugin.COMMISSION_PERCENTAGE * totalAmount));
        const givenAmount = totalAmount - commission;

        // If amount is zero substracting the commission
        if (givenAmount <= 0) {
            throw new Error('Given amount is zero');
        }

        // Actually transfer the money
        await UserController.buy(senderSession.user, totalAmount);
        await UserController.giveMoney(receiverSession.user, givenAmount);

        // Notify the receiver & sender
        this.room.send(
            'give',
            {
                sender: senderSession.user.sanitized(),
                receiver: receiverSession.user.sanitized(),
                givenAmount,
                commission,
            }
        );
        let message = senderSession.user.username + ' sent $' + givenAmount / 100 + ' to ' + receiverSession.user.username;
        if (commission > 0) {
            message += ' (- $' + (commission / 100) + ' commission)';
        }
        await this.room.sendMessage({
            content: message,
            user: UserController.getNeutralUser()
        });
        (this.room.getPlugin('connectedlist') as unknown as ConnectedListPlugin).sync();
    }
}
