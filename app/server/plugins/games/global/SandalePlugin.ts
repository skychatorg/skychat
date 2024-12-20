import { Connection } from '../../../skychat/Connection.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { Session } from '../../../skychat/Session.js';
import { User } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export class SandalePlugin extends GlobalPlugin {
    static readonly COST = 2 * 100;

    static readonly commandName = 'sandale';

    readonly minRight = 0;

    readonly hidden = true;

    readonly rules = {
        sandale: {
            minCount: 1,
            maxCount: 1,
            coolDown: 60 * 1e3,
            params: [
                {
                    name: 'username',
                    pattern: User.USERNAME_REGEXP,
                    info: 'Target username',
                },
            ],
        },
    };

    // We are not using a Set so that it can be serialized
    protected storage: { sandaled: { [username: string]: boolean } } = {
        sandaled: {},
    };

    constructor(manager: RoomManager) {
        super(manager);
        this.loadStorage();
    }

    /**
     * Is a given user sandaled?
     */
    private isSandaled(username: string): boolean {
        return !!this.storage.sandaled[username.toLowerCase()];
    }

    /**
     * Set sandaled state for a given user
     * @param username
     * @param sandaled
     */
    private setSandaled(username: string, sandaled: boolean): void {
        username = username.toLowerCase();
        if (sandaled) {
            this.storage.sandaled[username] = true;
        } else {
            delete this.storage.sandaled[username];
        }
        this.syncStorage();
    }

    /**
     * Register sandale requests
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const identifier = param;
        if (!Session.sessionExists(identifier)) {
            throw new Error('User ' + identifier + ' does not exist');
        }

        if (this.isSandaled(identifier)) {
            throw new Error('User ' + identifier + ' is already sandaled');
        }

        await UserController.buy(connection.session.user, SandalePlugin.COST);

        // Notify everyone but the user who is sandalized
        const messageContent = `${connection.session.identifier} sandaled ${identifier} 🤯 (cost: $${SandalePlugin.COST / 100}) 👞`;
        const message = UserController.createNeutralMessage({ id: 0, content: messageContent });
        if (connection.room) {
            connection.room.connections.forEach((c) => {
                if (c.session.identifier === identifier) {
                    return;
                }
                c.send('message', message.sanitized());
            });
        }
        this.setSandaled(identifier, true);
    }

    /**
     * Intercept all messages and sandale them if necessary
     * @param message
     * @param connection
     */
    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        if (message.indexOf('/message') === 0 && message.split(' ').length > 2 && this.isSandaled(connection.session.identifier)) {
            // Replace the message with the sandale smiley
            return '/message 👞';
        }
        return message;
    }
}