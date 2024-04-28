import { UserController } from '../../skychat/UserController.js';
import { Connection } from '../../skychat/Connection.js';
import { GlobalPlugin } from '../GlobalPlugin.js';
import { RoomManager } from '../../skychat/RoomManager.js';
import { Message } from '../../skychat/Message.js';

export class BunkerPlugin extends GlobalPlugin {
    static readonly commandName = 'bunker';

    readonly opOnly = true;

    readonly rules = {
        bunker: {
            minCount: 1,
            maxCount: 1,
            params: [
                {
                    name: 'mode',
                    pattern: /^(off|on)$/,
                },
            ],
        },
    };

    protected storage: boolean = false;

    constructor(manager: RoomManager) {
        super(manager);

        this.loadStorage();
    }

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        await this.handleBunker(param, connection);
    }

    async handleBunker(param: string, connection: Connection) {
        this.storage = param === 'on';
        this.syncStorage();

        connection.send(
            'message',
            new Message({
                content: 'Bunker mode: ' + (this.storage ? 'on' : 'off'),
                user: UserController.getNeutralUser(),
            }).sanitized(),
        );
    }

    async onBeforeRegister(): Promise<void> {
        if (this.storage) {
            throw new Error('Application currently in bunker mode. Registration is disabled.');
        }
    }
}
