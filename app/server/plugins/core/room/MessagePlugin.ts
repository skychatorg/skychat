import SQL from 'sql-template-strings';
import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { DatabaseHelper } from '../../../skychat/DatabaseHelper.js';
import { MessageController } from '../../../skychat/MessageController.js';
import { PluginCommandAllRules } from '../../Plugin.js';
import { RoomPlugin } from '../../RoomPlugin.js';
import { MessageLimiterPlugin } from '../../security_extra/MessageLimiterPlugin.js';
import { RoomProtectPlugin } from '../../security_extra/RoomProtectPlugin.js';
import { BlacklistPlugin } from '../global/BlacklistPlugin.js';

export class MessagePlugin extends RoomPlugin {
    static readonly commandName = 'message';

    readonly minRight = Config.PREFERENCES.minRightForPublicMessages;

    readonly hidden = true;

    readonly rules: PluginCommandAllRules = {
        message: {
            minCount: 1,
            maxCallsPer10Seconds: 100,
            callCostPerRight: Config.PREFERENCES.messagesCooldown,
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        let content = param;
        let quoted = null;

        // Parse quote
        const quoteMatch = content.match(/^@([0-9]+)/);
        const canQuote =
            connection.session.user.right >=
            Math.max(Config.PREFERENCES.minRightForMessageHistory, Config.PREFERENCES.minRightForMessageQuoting);

        // We also check that user has right to access message history
        if (quoteMatch && quoteMatch[1] && canQuote) {
            const quoteId = parseInt(quoteMatch[1]);

            // Try to find message in room message cache
            quoted = await this.room.getMessageById(quoteId);

            // Otherwise, try to find the quoted message in the database
            quoted = quoted || (await MessageController.getMessageById(quoteId, false));

            // If quote found, remove the quote string from the message
            if (quoted) {
                content = content.slice(quoteMatch[0].length);
            }

            const quotedRoom = quoted.room !== null ? this.room.manager.getRoomById(quoted.room) : null;
            const quotedRoomMinRight = quotedRoom?.getPlugin<RoomProtectPlugin>(RoomProtectPlugin.commandName)?.getMinRight() ?? -1;

            if (!quotedRoom) {
                // Room does not exist (anymore)
                quoted = null;
            } else if (quotedRoom.isPrivate && this.room.id !== quotedRoom.id) {
                // If message is private
                quoted = null;
            } else if (connection.session.user.right < quotedRoomMinRight) {
                // User does not have access to the room (according to RoomProtect plugin)
                quoted = null;
            } else if (quoted && BlacklistPlugin.hasBlacklisted(quoted?.user, connection.session.user.username)) {
                // If author has blacklisted the user, we don't allow the quote
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
