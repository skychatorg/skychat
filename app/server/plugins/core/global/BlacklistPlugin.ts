import { Connection } from '../../../skychat/Connection';
import { ConnectedListPlugin } from './ConnectedListPlugin';
import { UserController } from '../../../skychat/UserController';
import { GlobalPlugin } from '../../GlobalPlugin';
import { User } from '../../../skychat/User';


export type BlackList = Array<string>;

export class BlacklistPlugin extends GlobalPlugin {
    static readonly defaultDataStorageValue = [];

    static readonly MAX_BLACKLIST = 10;

    static readonly commandName = 'blacklist';

    static readonly commandAliases = ['unblacklist'];

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
                    info: 'User to blacklist'
                }
            ]
        },
        unblacklist: {
            minCount: 1,
            maxCount: 1,
            coolDown: 500,
            params: [
                {
                    name: 'username',
                    pattern: User.USERNAME_LOGGED_REGEXP,
                    info: 'User to unblacklist'
                }
            ]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (alias === 'blacklist') {
            await this.handleBlacklist(param, connection);
        } else if (alias === 'unblacklist') {
            await this.handleUnblacklist(param, connection);
        }
    }

    async handleBlacklist(param: string, connection: Connection) {
        const blacklist = UserController.getUserPluginData<string[]>(connection.session.user, this.commandName);
        if (blacklist.includes(param.toLowerCase())) {
            throw new Error(`User ${param} is already blacklisted`);
        }
        if (blacklist.length >= BlacklistPlugin.MAX_BLACKLIST) {
            throw new Error(`You can't blacklist more than ${BlacklistPlugin.MAX_BLACKLIST} users`);
        }
        blacklist.push(param.toLowerCase());
        await UserController.savePluginData(connection.session.user, this.commandName, blacklist);
        connection.send('message', UserController.createNeutralMessage({ content: 'User added to blacklist', id: 0, }).sanitized());
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }

    async handleUnblacklist(param: string, connection: Connection) {
        const blacklist = UserController.getUserPluginData<string[]>(connection.session.user, this.commandName);
        const index = blacklist.indexOf(param.toLowerCase());
        if (index === -1) {
            throw new Error(`User ${param} is not blacklisted`);
        }
        blacklist.splice(index, 1);
        await UserController.savePluginData(connection.session.user, this.commandName, blacklist);
        connection.send('message', UserController.createNeutralMessage({ content: 'User removed from blacklist', id: 0, }).sanitized());
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
