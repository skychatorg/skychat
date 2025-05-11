import { Connection } from '../../../skychat/Connection.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export class MutePlugin extends GlobalPlugin {
    static readonly commandName = 'mute';

    static readonly COMMAND_UNMUTE_NAME = 'unmute';
    static readonly COMMAND_MUTELIST_NAME = 'mutelist';

    static readonly commandAliases = [MutePlugin.commandName, MutePlugin.COMMAND_UNMUTE_NAME, MutePlugin.COMMAND_MUTELIST_NAME];

    readonly rules = {
        [MutePlugin.commandName]: {
            minCount: 1,
            maxCount: 1,
            params: [{ name: 'roomId', pattern: /^\d+$/ }],
        },
        [MutePlugin.COMMAND_UNMUTE_NAME]: {
            minCount: 1,
            maxCount: 1,
            params: [{ name: 'roomId', pattern: /^\d+$/ }],
        },
        [MutePlugin.COMMAND_MUTELIST_NAME]: {
            minCount: 0,
            maxCount: 0,
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const user = connection.session.user;
        const list: number[] = this.getUserData<number[]>(user) ?? [];
        const roomId = +param;
        const index = list.indexOf(roomId);

        switch (alias) {
            case 'mute':
                if (this.manager.getRoomById(roomId) === undefined) {
                    connection.send('error', `❌ Room ${roomId} does not exist`);
                    return;
                }
                if (!list.includes(roomId)) {
                    list.push(roomId);
                    this.saveUserData(user, list);
                    connection.session.syncUserData();
                }
                connection.send('info', `🔇 Muted room ${roomId}`);
                break;

            case 'unmute':
                if (index !== -1) {
                    list.splice(index, 1);
                    this.saveUserData(user, list);
                    connection.session.syncUserData();
                }
                connection.send('info', `🔊 Unmuted room ${roomId}`);
                break;

            case 'mutelist':
                connection.send('info', list.length ? `🔕 Currently muted rooms: ${list.join(', ')}` : '🔕 No muted rooms');
                break;
        }
    }
}
