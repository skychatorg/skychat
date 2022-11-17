import { Connection } from '../../../skychat/Connection';
import { Config } from '../../../skychat/Config';
import { MessageController } from '../../../skychat/MessageController';
import { RoomPlugin } from '../../RoomPlugin';
import { EncryptPlugin } from '../../crypto/room/EncryptPlugin';


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
        // we also check that user has right to access message history
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

        // Encrypted message?
        const encryptPlugin = this.room.getPlugin('encrypt') as undefined | EncryptPlugin;
        const isEncrypted = encryptPlugin && !! encryptPlugin.getRoomSummary();

        // Send the message to the room
        await this.room.sendMessage({
            content,
            user: connection.session.user,
            quoted,
            connection,
            meta: {
                encrypted: isEncrypted,
            },
        });

        // Update the date of the last sent message
        if (! this.room.isPrivate) {
            connection.session.lastPublicMessageSentDate = new Date();
        }
    }
}
