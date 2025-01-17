import { Connection } from '../../../skychat/Connection.js';
import { Logging } from '../../../skychat/Logging.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { User } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

import webpush from 'web-push';

type Subscription = {
    endpoint: string;
    expirationTime: number | null;
    keys: {
        auth: string;
        p256dh: string;
    };
};

export class WebPushPlugin extends GlobalPlugin {
    static readonly ENDPOINTS_WHITELIST = ['fcm.googleapis.com', '.push.services.mozilla.com', '.windows.com'];

    static readonly REPO_URL = 'https://github.com/skychatorg/skychat';

    static readonly MAX_SUBSCRIPTIONS = 10;

    static readonly commandName = 'push';

    static readonly commandAliases = ['pushclear'];

    readonly minRight = 0;

    readonly rules = {
        push: {
            minCount: 1,
            coolDown: 2000,
        },
        pushclear: {
            minCount: 0,
            maxCount: 0,
            coolDown: 5000,
        },
    };

    constructor(manager: RoomManager) {
        super(manager);

        webpush.setVapidDetails(WebPushPlugin.REPO_URL, process.env.VAPID_PUBLIC_KEY as string, process.env.VAPID_PRIVATE_KEY as string);
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (alias === 'push') {
            return this.handlePush(param, connection);
        } else if (alias === 'pushclear') {
            return this.handlePushClear(connection);
        }
    }

    async handlePush(param: string, connection: Connection): Promise<void> {
        const data = JSON.parse(param);
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data');
        }

        // Sanitize data
        if (typeof data.endpoint !== 'string') {
            throw new Error('Invalid endpoint');
        }
        const url = new URL(data.endpoint);
        if (!url || !url.hostname || !WebPushPlugin.ENDPOINTS_WHITELIST.some((allowed) => url.hostname.endsWith(allowed))) {
            throw new Error(`Endpoint ${url.hostname} not allowed for push notifications`);
        }
        if (typeof data.expirationTime !== 'number' && data.expirationTime !== null) {
            throw new Error('Invalid expirationTime');
        }
        if (typeof data.keys !== 'object') {
            throw new Error('Invalid keys');
        }
        if (typeof data.keys.auth !== 'string') {
            throw new Error('Invalid keys.auth');
        }
        if (typeof data.keys.p256dh !== 'string') {
            throw new Error('Invalid keys.p256dh');
        }
        const subscription: Subscription = {
            endpoint: data.endpoint,
            expirationTime: data.expirationTime,
            keys: {
                auth: data.keys.auth,
                p256dh: data.keys.p256dh,
            },
        };

        // Prepare to store the subscription
        const user = connection.session.user;
        if (!Array.isArray(user.storage[WebPushPlugin.commandName])) {
            user.storage[WebPushPlugin.commandName] = [];
        }

        // Does the subscription already exist?
        if (user.storage[WebPushPlugin.commandName].some((s: Subscription) => s.endpoint === subscription.endpoint)) {
            return;
        }

        // Store the subscription & clean up old ones
        user.storage[WebPushPlugin.commandName].push(subscription);
        while (user.storage[WebPushPlugin.commandName].length > WebPushPlugin.MAX_SUBSCRIPTIONS) {
            user.storage[WebPushPlugin.commandName].shift();
        }
        UserController.sync(user);
    }

    async handlePushClear(connection: Connection): Promise<void> {
        const user = connection.session.user;
        user.storage[WebPushPlugin.commandName] = [];
        await UserController.sync(user);
    }

    send(user: User, data: { title: string; body: string; tag: string }): void {
        const subscriptions = user.storage[WebPushPlugin.commandName] as Subscription[];
        if (!subscriptions) {
            return;
        }

        // We do not `await` not to block the main logic
        Logging.info(`Sending push notification to ${user.username}`);
        for (const subscription of subscriptions) {
            webpush
                .sendNotification(subscription, JSON.stringify(data))
                .then(() => {
                    Logging.info(`Push notification sent to ${user.username}`);
                })
                .catch(async (error) => {
                    // We delete the subscription if it is not valid anymore (we assume it is not if we can't send a notification once)
                    Logging.error(`Error sending push notification to ${user.username}`, error);
                    // drop `subscription` from `subscriptions`
                    user.storage[WebPushPlugin.commandName] = subscriptions.filter((s) => s !== subscription);
                    await UserController.sync(user);
                });
        }
    }
}
