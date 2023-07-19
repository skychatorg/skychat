import { Connection } from '../../../skychat/Connection';
import { Config } from '../../../skychat/Config';
import { MessageController } from '../../../skychat/MessageController';
import { RoomPlugin } from '../../RoomPlugin';
import { DatabaseHelper } from '../../../skychat/DatabaseHelper';
import SQL from 'sql-template-strings';


export class MessagePlugin extends RoomPlugin {
    static readonly commandName = 'message';

    readonly minRight = -1;

    readonly hidden = true;

    readonly rules = {
        message: { minCount: 1 }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        let content = param;
        let quoted = null;

        // Parse quote
        const quoteMatch = content.match(/^@([0-9]+)/);

        // We also check that user has right to access message history
        if (quoteMatch && quoteMatch[1] && connection.session.user.right >= Config.PREFERENCES.minRightForMessageHistory) {
            const quoteId = parseInt(quoteMatch[1]);

            // Try to find message in room message cache
            quoted = await this.room.getMessageById(quoteId);

            // Otherwise, try to find the quoted message in the database
            quoted = quoted || await MessageController.getMessageById(quoteId);

            // If quote found, remote the quote string from the message
            if (quoted) {
                content = content.slice(quoteMatch[0].length);
            }

            // If message is private
            const room = quoted.room !== null ? this.room.manager.getRoomById(quoted.room) : null;
            if (! room || (room.isPrivate && this.room.id !== room.id)) {
                quoted = null;
            }
        }

        // If the last N messages in this room are from the same user, we merge the messages
        const lastMessages = this.room.messages.slice(-Config.PREFERENCES.maxConsecutiveMessages);
        const matchingMessages = lastMessages.filter(m => m.user.username.toLowerCase() === connection.session.user.username.toLowerCase());
        if (! quoted && matchingMessages.length === Config.PREFERENCES.maxConsecutiveMessages && matchingMessages.length === lastMessages.length) {
            const lastMessage = lastMessages[lastMessages.length - 1];
            lastMessage.edit(
                lastMessage.content + '\n' + content,
                undefined,
                quoted,
            );
            this.room.send('message-edit', lastMessage.sanitized());
            await DatabaseHelper.db.run(SQL`update messages set content = ${lastMessage.content} where id = ${lastMessage.id}`);
            return;
        }

        // Send the message to the room
        await this.room.sendMessage({
            content,
            user: connection.session.user,
            quoted,
            connection
        });

        // Update the date of the last sent message
        if (! this.room.isPrivate) {
            connection.session.lastPublicMessageSentDate = new Date();
        }
    }
}
