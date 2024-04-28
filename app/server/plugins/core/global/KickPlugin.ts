import { Connection } from '../../../skychat/Connection.js';
import { User } from '../../../skychat/User.js';
import { Session } from '../../../skychat/Session.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { Config } from '../../../skychat/Config.js';

/**
 * The kick plugin allows to force the disconnection of all the connections belonging to a session
 */
export class KickPlugin extends GlobalPlugin {
    static readonly commandName = 'kick';

    readonly minRight = Config.PREFERENCES.minRightForUserModeration === 'op' ? 0 : Config.PREFERENCES.minRightForUserModeration;

    readonly opOnly = Config.PREFERENCES.minRightForUserModeration === 'op';

    readonly rules = {
        kick: {
            minCount: 1,
            maxCount: 1,
            params: [{ name: 'username', pattern: User.USERNAME_REGEXP }],
        },
    };

    async run(alias: string, param: string): Promise<void> {
        const identifier = param.toLowerCase();
        const session = Session.getSessionByIdentifier(identifier);
        if (!session) {
            throw new Error('Username not found');
        }
        for (const connection of session.connections) {
            connection.close(Connection.CLOSE_KICKED, 'You have been kicked');
        }
    }
}
