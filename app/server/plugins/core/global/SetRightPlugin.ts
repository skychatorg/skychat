import { User } from '../../../skychat/User.js';
import { Session } from '../../../skychat/Session.js';
import { ConnectedListPlugin } from './ConnectedListPlugin.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { Config } from '../../../skychat/Config.js';
import lodash from 'lodash';
import { Connection } from '../../../skychat/Connection.js';

export class SetRightPlugin extends GlobalPlugin {
    static readonly commandName = 'setright';

    readonly rules = {
        setright: {
            minCount: 2,
            maxCount: 2,
            params: [
                { name: 'username', pattern: User.USERNAME_LOGGED_REGEXP },
                { name: 'right', pattern: /^([0-9]+)$/ },
            ],
        },
    };

    readonly minRight = Config.PREFERENCES.minRightForSetRight === 'op' ? 0 : Config.PREFERENCES.minRightForSetRight;

    readonly opOnly = Config.PREFERENCES.minRightForSetRight === 'op';

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        const [usernameRaw, rightRaw] = param.split(' ');
        const identifier = usernameRaw.toLowerCase();
        const right = parseInt(rightRaw);

        if (!lodash.isInteger(right)) {
            throw new Error('Invalid right');
        }

        const session = Session.getSessionByIdentifier(identifier);
        if (!session) {
            throw new Error('User not found');
        }

        if (connection.session.user.right <= session.user.right && !connection.session.isOP()) {
            throw new Error('You cannot change the right of a user with a higher or equal right than yours');
        }

        if (right >= connection.session.user.right && !connection.session.isOP()) {
            throw new Error('You cannot set a right higher or equal to yours');
        }

        const user = session.user;
        user.right = right;
        await UserController.sync(user);
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
