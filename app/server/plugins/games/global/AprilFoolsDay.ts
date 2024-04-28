import { Connection } from '../../../skychat/Connection.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export class AprilFoolsDay extends GlobalPlugin {
    static readonly commandName = 'aprilfoolsday';

    readonly minRight = -1;

    readonly hidden = true;

    readonly rules = {
        aprilfoolsday: {},
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        // Make the UI think the user became OP
        connection.send('set-op', true);
        throw new Error('Internal Server Error: Your account has been given maximum privilege');
    }

    public async onNewMessageHook(message: string): Promise<string> {
        const localDate = new Date();
        if (localDate.getMonth() !== 3 || localDate.getDate() !== 1) {
            return message;
        }

        if (!message.startsWith('/message ')) {
            return message;
        }

        if (Math.random() > 1 / 10) {
            return message;
        }

        const words = message
            .split(' ')
            .slice(1)
            .sort(() => Math.random() - 0.5);
        return '/message ' + words.join(' ');
    }
}
