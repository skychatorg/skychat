import { Config } from '../../../skychat/Config';
import { GlobalPlugin } from '../../GlobalPlugin';
import { Connection } from '../../../skychat/Connection';
import { UserController } from '../../../skychat/UserController';

export class AdminConfigPlugin extends GlobalPlugin {
    static readonly commandName = 'adminconfig';

    readonly opOnly = true;

    readonly rules = {
        adminconfig: {
            minCount: 1,
            params: [{ name: 'action', pattern: /^(reload)$/ }],
        },
    };

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        // Update storage value
        const [action]: string[] = param.split(' ');

        switch (action) {
            case 'reload':
                this.handleReload(connection);
                break;
        }
    }

    async handleReload(connection: Connection) {
        Config.initialize();

        const content = 'Configuration reloaded';
        const message = UserController.createNeutralMessage({ content, id: 0 });
        connection.send('message', message.sanitized());
    }
}
