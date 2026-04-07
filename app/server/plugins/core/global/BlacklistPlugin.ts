import { Connection } from '../../../skychat/Connection.js';
import { ConnectedListPlugin } from './ConnectedListPlugin.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { User } from '../../../skychat/User.js';

export type BlackListData = {
    users: string[];
    guests: boolean;
};

export class BlacklistPlugin extends GlobalPlugin {
    static readonly defaultDataStorageValue: BlackListData = { users: [], guests: false };

    static readonly MAX_BLACKLIST = 10;

    static readonly commandName = 'blacklist';

    static readonly commandAliases = ['unblacklist', 'blacklistguests', 'unblacklistguests'];

    /**
     * Normalize legacy data (plain array) to the current format.
     */
    private static normalize(raw: unknown): BlackListData {
        if (Array.isArray(raw)) {
            return { users: raw, guests: false };
        }
        return raw as BlackListData;
    }

    static getData(user: User): BlackListData {
        return this.normalize(UserController.getUserPluginData<BlackListData | string[]>(user, this.commandName));
    }

    static hasBlacklisted(user: User, username: string) {
        return this.getData(user).users.includes(username.toLowerCase());
    }

    static hasBlacklistedGuests(user: User) {
        return this.getData(user).guests;
    }

    /**
     * Check if the blocker has blocked the target (per-user or all-guests).
     */
    static isBlockedBy(blocker: User, target: User) {
        const data = this.getData(blocker);
        if (target.isGuest() && data.guests) {
            return true;
        }
        return data.users.includes(target.username.toLowerCase());
    }

    readonly minRight = 0;

    readonly rules = {
        blacklist: {
            minCount: 1,
            maxCount: 1,
            coolDown: 500,
            params: [
                {
                    name: 'username',
                    pattern: User.USERNAME_LOGGED_REGEXP,
                    info: 'User to blacklist',
                },
            ],
        },
        unblacklist: {
            minCount: 1,
            maxCount: 1,
            coolDown: 500,
            params: [
                {
                    name: 'username',
                    pattern: User.USERNAME_LOGGED_REGEXP,
                    info: 'User to unblacklist',
                },
            ],
        },
        blacklistguests: {
            minCount: 0,
            maxCount: 0,
            coolDown: 500,
        },
        unblacklistguests: {
            minCount: 0,
            maxCount: 0,
            coolDown: 500,
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (alias === 'blacklist') {
            await this.handleBlacklist(param, connection);
        } else if (alias === 'unblacklist') {
            await this.handleUnblacklist(param, connection);
        } else if (alias === 'blacklistguests') {
            await this.handleBlacklistGuests(connection);
        } else if (alias === 'unblacklistguests') {
            await this.handleUnblacklistGuests(connection);
        }
    }

    async handleBlacklist(param: string, connection: Connection) {
        const data = BlacklistPlugin.getData(connection.session.user);
        if (data.users.includes(param.toLowerCase())) {
            throw new Error(`User ${param} is already blacklisted`);
        }
        if (data.users.length >= BlacklistPlugin.MAX_BLACKLIST) {
            throw new Error(`You can't blacklist more than ${BlacklistPlugin.MAX_BLACKLIST} users`);
        }
        data.users.push(param.toLowerCase());
        await UserController.savePluginData(connection.session.user, this.commandName, data);
        connection.session.syncUserData();
        connection.send('message', UserController.createNeutralMessage({ content: 'User added to blacklist', id: 0 }).sanitized());
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }

    async handleUnblacklist(param: string, connection: Connection) {
        const data = BlacklistPlugin.getData(connection.session.user);
        const index = data.users.indexOf(param.toLowerCase());
        if (index === -1) {
            throw new Error(`User ${param} is not blacklisted`);
        }
        data.users.splice(index, 1);
        await UserController.savePluginData(connection.session.user, this.commandName, data);
        connection.session.syncUserData();
        connection.send('message', UserController.createNeutralMessage({ content: 'User removed from blacklist', id: 0 }).sanitized());
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }

    async handleBlacklistGuests(connection: Connection) {
        const data = BlacklistPlugin.getData(connection.session.user);
        if (data.guests) {
            throw new Error('Guests are already blacklisted');
        }
        data.guests = true;
        await UserController.savePluginData(connection.session.user, this.commandName, data);
        connection.session.syncUserData();
        connection.send('message', UserController.createNeutralMessage({ content: 'All guests are now blacklisted', id: 0 }).sanitized());
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }

    async handleUnblacklistGuests(connection: Connection) {
        const data = BlacklistPlugin.getData(connection.session.user);
        if (!data.guests) {
            throw new Error('Guests are not blacklisted');
        }
        data.guests = false;
        await UserController.savePluginData(connection.session.user, this.commandName, data);
        connection.session.syncUserData();
        connection.send('message', UserController.createNeutralMessage({ content: 'Guests are no longer blacklisted', id: 0 }).sanitized());
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
