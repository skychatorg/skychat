import { User } from '../../skychat/User.js';
import { Session } from '../../skychat/Session.js';
import { RoomPlugin } from '../RoomPlugin.js';

/**
 *
 */
export class UsurpPlugin extends RoomPlugin {
    static readonly commandName = 'usurp';

    readonly opOnly = true;

    readonly rules = {
        usurp: {
            minCount: 2,
            params: [
                { name: 'username', pattern: User.USERNAME_REGEXP },
                { name: 'command', pattern: /./ },
            ],
        },
    };

    async run(alias: string, param: string): Promise<void> {
        const identifier = param.split(' ')[0].toLowerCase();
        const commandName = param.split(' ')[1];
        const session = Session.getSessionByIdentifier(identifier);
        if (!session || session.connections.length === 0) {
            throw new Error('User ' + identifier + ' does not exist');
        }
        const command = this.room.getPlugin(commandName) || this.room.manager.getPlugin(commandName);
        if (!command) {
            throw new Error(`Command ${commandName} does not exist`);
        }
        await command.run(commandName, param.split(' ').slice(2).join(' '), session.connections[0], session, session.user, this.room);
    }
}
