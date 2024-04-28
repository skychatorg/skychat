import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { UserController } from '../../../skychat/UserController.js';

export class OPPlugin extends GlobalPlugin {
    static readonly commandName = 'op';

    static readonly commandAliases = ['opexit'];

    readonly minRight = 0;

    readonly rules = {
        op: {
            minCount: 0,
            maxCount: 1,
            coolDown: 1000,
            maxCallsPer10Seconds: 2,
        },
        opexit: {
            maxCount: 0,
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        // Check that the user identifier is in the list of OP usernames
        if (!Config.isInOPList(connection.session.identifier)) {
            throw new Error('Not in OP list');
        }

        if (alias === 'op') {
            return this.handleOP(param, connection);
        }

        if (alias === 'opexit') {
            return this.handleOpExit(param, connection);
        }
    }

    async handleOP(param: string, connection: Connection): Promise<void> {
        if (Config.OP_PASSCODE !== null && param !== Config.OP_PASSCODE) {
            throw new Error('Invalid passcode');
        }
        connection.session.setOP(true);
        connection.send(
            'message',
            UserController.createNeutralMessage({
                id: 0,
                content: 'OP mode enabled 😲',
            }).sanitized(),
        );
    }

    async handleOpExit(param: string, connection: Connection): Promise<void> {
        if (!connection.session.isOP()) {
            throw new Error('Not op');
        }
        connection.session.setOP(false);
        connection.send(
            'message',
            UserController.createNeutralMessage({
                id: 0,
                content: 'OP mode disabled 🤔',
            }).sanitized(),
        );
    }
}
