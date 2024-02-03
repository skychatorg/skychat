import SQL from 'sql-template-strings';
import { Connection } from '../../../skychat/Connection';
import { DatabaseHelper } from '../../../skychat/DatabaseHelper';
import { RoomPlugin } from '../../RoomPlugin';
import { MessageLimiterPlugin } from '../../security_extra/MessageLimiterPlugin';

export class MessageEditPlugin extends RoomPlugin {
    static readonly commandName = 'edit';

    static readonly commandAliases = ['delete'];

    readonly minRight = 0;

    readonly rules = {
        edit: {
            minCount: 2,
            coolDown: 2000,
            params: [
                { pattern: /^([0-9]+)$/, name: 'id' },
                { pattern: /.?/, name: 'message' },
            ],
        },
        delete: {
            minCount: 1,
            maxCount: 1,
            coolDown: 2000,
            params: [{ pattern: /^([0-9]+)$/, name: 'id' }],
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const id = parseInt(param.split(' ')[0]);

        // Find message
        const message = await this.room.getMessageById(id);

        if (!message) {
            throw new Error('Message not found');
        }

        // Check rights
        if (message.user !== connection.session.user && !connection.session.isOP()) {
            throw new Error('You can only edit your own messages');
        }

        // Edit message
        if (alias === 'edit') {
            const content = param.split(' ').slice(1).join(' ');
            if (!this.room.getPlugin<MessageLimiterPlugin>(MessageLimiterPlugin.commandName)?.allowMessageEdit(message, content)) {
                throw new Error(MessageLimiterPlugin.errorMessage);
            }
            message.edit(content);
        } else {
            message.edit('deleted', '<s>deleted</s>');
        }

        // Store it into the database
        await DatabaseHelper.db.query(SQL`update messages set content = ${message.content} where id = ${message.id}`);

        // Notify room
        this.room.send('message-edit', message.sanitized());
    }
}
