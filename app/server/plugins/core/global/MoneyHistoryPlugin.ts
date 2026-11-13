import { Connection } from '../../../skychat/Connection.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

/**
 * Sends the user their last money changes, asked for when they look at them rather than pushed on every change
 */
export class MoneyHistoryPlugin extends GlobalPlugin {
    static readonly commandName = 'moneyhistory';

    readonly minRight = 0;

    readonly rules = {
        moneyhistory: {
            maxCount: 0,
            maxCallsPer10Seconds: 20,
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        connection.send('money-history', await UserController.getMoneyHistory(connection.session.user));
    }
}
