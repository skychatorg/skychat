import SQL from 'sql-template-strings';
import { EncryptedMessagePayload } from '../../../../api/encryption.js';
import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { DatabaseHelper } from '../../../skychat/DatabaseHelper.js';
import { Message, MessageStorage } from '../../../skychat/Message.js';
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

    static readonly ENCRYPTED_PLACEHOLDER = '[encrypted message]';

    static readonly ENCRYPTED_PLACEHOLDER_FORMATTED = '<i>Encrypted message</i>';

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        let content = param;
        let quoted: Message | null = null;
        let storage: MessageStorage | undefined;
        let formatted: string | undefined;

        const canQuote =
            connection.session.user.right >=
            Math.max(Config.PREFERENCES.minRightForMessageHistory, Config.PREFERENCES.minRightForMessageQuoting);

        const encryptedPayload = this.parseEncryptedPayload(content);

        if (encryptedPayload) {
            if (connection.session.user.right < Config.PREFERENCES.minRightForEncryptedMessages) {
                throw new Error('You are not allowed to send encrypted messages.');
            }
            storage = { ...Message.DEFAULT_STORAGE, e2ee: encryptedPayload };
            content = MessagePlugin.ENCRYPTED_PLACEHOLDER;
            formatted = MessagePlugin.ENCRYPTED_PLACEHOLDER_FORMATTED;
            if (encryptedPayload.quotedId && canQuote) {
                quoted = await this.loadQuotedMessage(encryptedPayload.quotedId, connection);
            }
        } else {
            const quoteMatch = content.match(/^@([0-9]+)/);
            if (quoteMatch && quoteMatch[1] && canQuote) {
                const quoteId = parseInt(quoteMatch[1]);
                quoted = await this.loadQuotedMessage(quoteId, connection);
                if (quoted) {
                    content = content.slice(quoteMatch[0].length);
                }
            }
        }

        // If the last N messages in this room are from the same user, we merge the messages
        if (!encryptedPayload) {
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
        }

        // Send the message to the room
        await this.room.sendMessage({
            content,
            formatted,
            user: connection.session.user,
            quoted,
            connection,
            meta: {
                encrypted: Boolean(encryptedPayload),
                keyHash: encryptedPayload?.keyHash,
                encryptionLabel: encryptedPayload?.label ?? null,
            },
            storage,
        });

        // Update the date of the last sent message
        if (!this.room.isPrivate) {
            connection.session.lastPublicMessageSentDate = new Date();
        }
    }

    private parseEncryptedPayload(content: string): EncryptedMessagePayload | null {
        let payload: EncryptedMessagePayload;
        try {
            payload = JSON.parse(content);
        } catch (error) {
            return null;
        }
        if (!payload || typeof payload !== 'object') {
            return null;
        }
        if ((payload as EncryptedMessagePayload).type !== 'skychat.e2ee') {
            return null;
        }
        if (typeof payload.ciphertext !== 'string' || typeof payload.iv !== 'string') {
            throw new Error('Malformed encrypted payload');
        }
        if (typeof payload.salt !== 'string' || typeof payload.keyHash !== 'string') {
            throw new Error('Malformed encrypted payload');
        }
        if (typeof payload.version !== 'number') {
            throw new Error('Missing encrypted payload version');
        }
        return payload;
    }

    private async loadQuotedMessage(quoteId: number, connection: Connection): Promise<Message | null> {
        if (!quoteId) {
            return null;
        }

        const canQuote =
            connection.session.user.right >=
            Math.max(Config.PREFERENCES.minRightForMessageHistory, Config.PREFERENCES.minRightForMessageQuoting);

        if (!canQuote) {
            return null;
        }

        let quoted = this.room.getMessageById(quoteId);
        quoted = quoted || (await MessageController.getMessageById(quoteId, false));
        if (!quoted) {
            return null;
        }

        const quotedRoom = quoted.room !== null ? this.room.manager.getRoomById(quoted.room) : null;
        const quotedRoomMinRight = quotedRoom?.getPlugin<RoomProtectPlugin>(RoomProtectPlugin.commandName)?.getMinRight() ?? -1;

        if (!quotedRoom) {
            return null;
        }
        if (quotedRoom.isPrivate && this.room.id !== quotedRoom.id) {
            return null;
        }
        if (connection.session.user.right < quotedRoomMinRight) {
            return null;
        }
        if (quoted && BlacklistPlugin.hasBlacklisted(quoted.user, connection.session.user.username)) {
            return null;
        }
        return quoted;
    }
}
