import { UserController } from '../../skychat/UserController';
import { Connection } from '../../skychat/Connection';
import { GlobalPlugin } from '../GlobalPlugin';
import { RoomManager } from '../../skychat/RoomManager';
import { Message } from '../../skychat/Message';

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
