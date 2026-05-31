import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { Connection } from '../../../skychat/Connection.js';
import { Logging } from '../../../skychat/Logging.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { User } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export class ExpoPushPlugin extends GlobalPlugin {
    static readonly MAX_TOKENS = 10;

    static readonly commandName = 'expopush';

    static readonly commandAliases = ['expopushclear'];

    readonly minRight = 0;

    readonly rules = {
        expopush: {
            minCount: 1,
            coolDown: 2000,
        },
        expopushclear: {
            minCount: 0,
            maxCount: 0,
            coolDown: 5000,
        },
    };

    private expo = new Expo();

    constructor(manager: RoomManager) {
        super(manager);
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (alias === 'expopush') {
            return this.handleRegister(param, connection);
        } else if (alias === 'expopushclear') {
            return this.handleClear(connection);
        }
    }

    async handleRegister(param: string, connection: Connection): Promise<void> {
        const token = param.trim();
        if (!Expo.isExpoPushToken(token)) {
            throw new Error('Invalid Expo push token');
        }

        const user = connection.session.user;
        if (!Array.isArray(user.storage[ExpoPushPlugin.commandName])) {
            user.storage[ExpoPushPlugin.commandName] = [];
        }

        // Already registered?
        if ((user.storage[ExpoPushPlugin.commandName] as string[]).includes(token)) {
            return;
        }

        user.storage[ExpoPushPlugin.commandName].push(token);
        while (user.storage[ExpoPushPlugin.commandName].length > ExpoPushPlugin.MAX_TOKENS) {
            user.storage[ExpoPushPlugin.commandName].shift();
        }
        await UserController.sync(user);
    }

    async handleClear(connection: Connection): Promise<void> {
        const user = connection.session.user;
        user.storage[ExpoPushPlugin.commandName] = [];
        await UserController.sync(user);
    }

    send(user: User, data: { title: string; body: string; tag: string }): void {
        const tokens = user.storage[ExpoPushPlugin.commandName] as string[] | undefined;
        if (!tokens || tokens.length === 0) {
            return;
        }

        const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
        if (validTokens.length === 0) {
            return;
        }

        const messages: ExpoPushMessage[] = validTokens.map((token) => ({
            to: token,
            sound: 'default' as const,
            title: data.title,
            body: data.body,
            data: { tag: data.tag },
        }));

        Logging.info(`Sending Expo push notification to ${user.username}`);
        this.expo
            .sendPushNotificationsAsync(messages)
            .then((tickets: ExpoPushTicket[]) => {
                const invalidTokens = new Set<string>();
                for (let i = 0; i < tickets.length; i++) {
                    const ticket = tickets[i];
                    if (ticket.status === 'error') {
                        Logging.error(`Expo push error for ${user.username}: ${ticket.message}`);
                        if (ticket.details?.error === 'DeviceNotRegistered') {
                            invalidTokens.add(validTokens[i]);
                        }
                    }
                }
                if (invalidTokens.size > 0) {
                    user.storage[ExpoPushPlugin.commandName] = tokens.filter((t) => !invalidTokens.has(t));
                    return UserController.sync(user);
                }
            })
            .catch((error: unknown) => {
                Logging.error(`Error sending Expo push notification to ${user.username}`, error);
            });
    }
}
