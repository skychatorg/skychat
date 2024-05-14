import { Connection } from '../../../skychat/Connection.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

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
        if (!process.env.OP_LIST || process.env.OP_LIST.trim().length === 0) {
            throw new Error(
                'No OP list was set. Please set the OP_LIST environment variable if you want to have admin access to your instance.',
            );
        }
        const opList = process.env.OP_LIST.toLowerCase().split(',');
        if (!opList.includes(connection.session.identifier.toLowerCase())) {
            throw new Error('Not OP');
        }

        if (alias === 'op') {
            return this.handleOP(param, connection);
        }

        if (alias === 'opexit') {
            return this.handleOpExit(param, connection);
        }
    }

    async handleOP(param: string, connection: Connection): Promise<void> {
        if (!process.env.OP_PASSCODE || process.env.OP_PASSCODE.trim().length === 0) {
            throw new Error('OP passcode not set');
        } else if (param !== process.env.OP_PASSCODE) {
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
