import { Connection } from '../../../skychat/Connection';
import { Config } from '../../../skychat/Config';
import { MessageController } from '../../../skychat/MessageController';
import { RoomPlugin } from '../../RoomPlugin';
import { DatabaseHelper } from '../../../skychat/DatabaseHelper';
import SQL from 'sql-template-strings';
import { MessageLimiterPlugin } from '../../security_extra/MessageLimiterPlugin';
import { BlacklistPlugin } from '../global/BlacklistPlugin';

export class MessagePlugin extends RoomPlugin {
    static readonly commandName = 'message';

    readonly minRight = Config.PREFERENCES.minRightForPublicMessages;

    readonly hidden = true;

    readonly rules = {
        message: {
            minCount: 1,
            coolDown: Config.PREFERENCES.messagesCooldown,
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        let content = param;
        let quoted = null;

        // Parse quote
        const quoteMatch = content.match(/^@([0-9]+)/);
        const canQuote = connection.session.user.right >= Config.PREFERENCES.minRightForMessageHistory;

        // We also check that user has right to access message history
        if (quoteMatch && quoteMatch[1] && canQuote) {
            const quoteId = parseInt(quoteMatch[1]);

            // Try to find message in room message cache
            quoted = await this.room.getMessageById(quoteId);

            // Otherwise, try to find the quoted message in the database
            quoted = quoted || (await MessageController.getMessageById(quoteId));

            // If author has blacklisted the user, we don't allow the quote
            if (quoted && BlacklistPlugin.hasBlacklisted(quoted?.user, connection.session.user.username)) {
                throw new Error(`User ${param} has blacklisted you. You can not quote his messages`);
            }

            // If quote found, remove the quote string from the message
            if (quoted) {
                content = content.slice(quoteMatch[0].length);
            }

            // If message is private
            const room = quoted.room !== null ? this.room.manager.getRoomById(quoted.room) : null;
            if (!room || (room.isPrivate && this.room.id !== room.id)) {
                quoted = null;
            }
        }

        // If the last N messages in this room are from the same user, we merge the messages
        const lastMessages = this.room.messages.slice(-Config.PREFERENCES.maxConsecutiveMessages);
        const matchingMessages = lastMessages.filter(
            (m) => m.user.username.toLowerCase() === connection.session.user.username.toLowerCase(),
        );
        const tooManyMessages =
            matchingMessages.length === Config.PREFERENCES.maxConsecutiveMessages && matchingMessages.length === lastMessages.length;
        const lastMessageTooRecent =
            lastMessages.length > 0 &&
            new Date().getTime() - lastMessages[lastMessages.length - 1].createdTime.getTime() <
                Config.PREFERENCES.maxMessageMergeDelayMin * 60 * 1000;
        if (!quoted && tooManyMessages && lastMessageTooRecent) {
            const lastMessage = lastMessages[lastMessages.length - 1];
            const newContent = lastMessage.content + '\n' + content;

            // Ensure message limit is not reached
            if (!this.room.getPlugin<MessageLimiterPlugin>(MessageLimiterPlugin.commandName)?.allowMessageEdit(lastMessage, newContent)) {
                throw new Error(MessageLimiterPlugin.errorMessage);
            }

            lastMessage.edit(newContent);
            this.room.send('message-edit', lastMessage.sanitized());
            await DatabaseHelper.db.query(SQL`update messages set content = ${lastMessage.content} where id = ${lastMessage.id}`);
            return;
        }

        // Send the message to the room
        await this.room.sendMessage({
            content,
            user: connection.session.user,
            quoted,
            connection,
        });

        // Update the date of the last sent message
        if (!this.room.isPrivate) {
            connection.session.lastPublicMessageSentDate = new Date();
        }
    }
}
