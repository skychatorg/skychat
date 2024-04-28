import { Connection } from '../../../skychat/Connection.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { Session } from '../../../skychat/Session.js';
import { User } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export class ConfusePlugin extends GlobalPlugin {
    static readonly COST = 2 * 100;

    static readonly commandName = 'confuse';

    readonly minRight = 0;

    readonly hidden = true;

    readonly rules = {
        confuse: {
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
    protected storage: { confused: { [username: string]: boolean } } = {
        confused: {},
    };

    constructor(manager: RoomManager) {
        super(manager);
        this.loadStorage();
    }

    /**
     * Is a given user confused?
     */
    private isConfused(username: string): boolean {
        return !!this.storage.confused[username.toLowerCase()];
    }

    /**
     * Set confused state for a given user
     * @param username
     * @param confused
     */
    private setConfused(username: string, confused: boolean): void {
        username = username.toLowerCase();
        if (confused) {
            this.storage.confused[username] = true;
        } else {
            delete this.storage.confused[username];
        }
        this.syncStorage();
    }

    /**
     * Register confuse requests
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const identifier = param;
        if (!Session.sessionExists(identifier)) {
            throw new Error('User ' + identifier + ' does not exist');
        }

        if (this.isConfused(identifier)) {
            throw new Error('User ' + identifier + ' is already confused');
        }

        await UserController.buy(connection.session.user, ConfusePlugin.COST);

        // Notify everyone but the user who is sandalized
        const messageContent = `${connection.session.identifier} confused ${identifier} 🤯 (cost: $${ConfusePlugin.COST / 100})`;
        const message = UserController.createNeutralMessage({ id: 0, content: messageContent });
        if (connection.room) {
            connection.room.connections.forEach((c) => {
                if (c.session.identifier === identifier) {
                    return;
                }
                c.send('message', message.sanitized());
            });
        }
        this.setConfused(identifier, true);
    }

    /**
     * Intercept all messages and confuse them if necessary
     * @param message
     * @param connection
     */
    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        if (message.indexOf('/message') === 0 && message.split(' ').length > 2 && this.isConfused(connection.session.identifier)) {
            // Re-order all words randomly
            const words = message.split(' ').slice(1);
            words.sort(() => Math.random() - 0.5);
            this.setConfused(connection.session.identifier, false);
            return '/message ' + words.join(' ');
        }
        return message;
    }
}
