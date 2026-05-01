import { Connection } from '../../../skychat/Connection.js';
import { Session } from '../../../skychat/Session.js';
import { User } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export class WizzPlugin extends GlobalPlugin {
    static readonly COST = 10 * 100;

    static readonly commandName = 'wizz';

    readonly minRight = 0;

    readonly hidden = true;

    readonly rules = {
        wizz: {
            minCount: 1,
            maxCount: 1,
            coolDown: 10 * 1e3,
            params: [
                {
                    name: 'username',
                    pattern: User.USERNAME_REGEXP,
                    info: 'Target username',
                },
            ],
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const identifier = param.replace(/^@/, '').toLowerCase();
        const sender = connection.session.user;

        if (identifier === sender.username.toLowerCase()) {
            throw new Error("You can't wizz yourself");
        }
        if (!Session.sessionExists(identifier)) {
            throw new Error('User ' + identifier + ' does not exist');
        }
        const target = Session.getSessionByIdentifier(identifier);
        if (!target) {
            throw new Error('User ' + identifier + ' is not connected');
        }

        await UserController.buy(sender, WizzPlugin.COST);

        target.send('wizz', { from: sender.sanitized() });
    }
}
