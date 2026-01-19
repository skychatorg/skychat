import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { MessageController } from '../../../skychat/MessageController.js';
import { RoomPlugin } from '../../RoomPlugin.js';

export class MessageSearchPlugin extends RoomPlugin {
    static readonly commandName = 'messagesearch';

    static readonly MIN_QUERY_LENGTH = 3;

    static readonly MAX_RESULTS = 500;

    readonly rules = {
        messagesearch: {
            minCount: 1,
            maxCallsPer10Seconds: 3,
        },
    };

    readonly callable = true;

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        const query = param.trim();

        if (!connection.room) {
            throw new Error('You need to join a room before searching messages');
        }

        if (connection.session.user.right < Config.PREFERENCES.minRightForMessageHistory) {
            throw new Error('You do not have the permission to search messages');
        }

        if (!query) {
            throw new Error('Please provide a search query');
        }

        if (query.length < MessageSearchPlugin.MIN_QUERY_LENGTH) {
            throw new Error(`Search query must be at least ${MessageSearchPlugin.MIN_QUERY_LENGTH} characters long`);
        }

        const messages = await MessageController.searchMessages(connection.room.id, query, MessageSearchPlugin.MAX_RESULTS);

        connection.send('message-search', {
            roomId: connection.room.id,
            query,
            results: messages.map((message) => message.sanitized()),
        });
    }
}
