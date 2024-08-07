import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export class WelcomePlugin extends GlobalPlugin {
    static readonly commandName = 'welcome';

    readonly callable = false;

    async run() {
        throw new Error('Method not implemented.');
    }

    async onNewConnection(connection: Connection) {
        const message = Config.WELCOME_MESSAGE;
        if (!message) {
            return;
        }

        if (connection.session.user.id > 0) {
            return;
        }

        connection.send('message', UserController.createNeutralMessage({ content: message, room: connection.roomId, id: 0 }).sanitized());
    }
}
