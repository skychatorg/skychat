import { Connection } from '../../skychat/Connection.js';
import { Message } from '../../skychat/Message.js';
import { RoomManager } from '../../skychat/RoomManager.js';
import { UserController } from '../../skychat/UserController.js';
import { GlobalPlugin } from '../GlobalPlugin.js';

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

    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        if (this.storage && connection.session.user.isGuest()) {
            return 'Bunker mode enabled. No messages can be sent as guest.';
        }
        return message;
    }
}
