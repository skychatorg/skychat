import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { Message } from '../../../skychat/Message.js';
import { Room } from '../../../skychat/Room.js';
import { StickerManager } from '../../../skychat/StickerManager.js';
import { User } from '../../../skychat/User.js';
import { RoomPlugin } from '../../RoomPlugin.js';

export class MessageHistoryPlugin extends RoomPlugin {
    static readonly commandName = 'messagehistory';

    readonly hidden = true;

    readonly rules = {
        messagehistory: {
            minCount: 0,
            // Scrolling up in a busy room fires this often; too low a cap leaves the client waiting forever
            maxCallsPer10Seconds: 30,
            params: [{ pattern: /^([0-9]+)$/, name: 'lastId' }],
        },
    };

    /**
     * Push the history the client shows when it lands in this room. Sent on join so the client does not
     * need a second round-trip (and can not be rate-limited out of ever leaving its loading state).
     */
    sendInitialHistory(connection: Connection): void {
        this.sendHistory('', connection);
    }

    async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        this.sendInitialHistory(connection);
    }

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        this.sendHistory(param, connection);
    }

    private sendHistory(param: string, connection: Connection): void {
        // Asking for short term history
        if (!parseInt(param) && connection.session.user.right >= Config.PREFERENCES.minRightForShortTermMessageHistory) {
            this.room.sendHistory(connection, 0);
            return;
        }

        // Asking for long term history
        if (connection.session.user.right >= Config.PREFERENCES.minRightForMessageHistory) {
            this.room.sendHistory(connection, parseInt(param));
            return;
        }

        // If a param is specified, we ignore the request, as the user tries to get previous messages but we won't bother faking them
        if (param) {
            return;
        }
        // Send fake message history to the connection that just joined this room
        const fakeMessages = [];
        for (let i = Math.max(0, this.room.messages.length - Room.MESSAGE_HISTORY_VISIBLE_LENGTH); i < this.room.messages.length; ++i) {
            // Each fake message correspond to a real message
            const realMessage = this.room.messages[i];
            const hash = realMessage.createdTime.getTime() + realMessage.id;
            const message = this.getFakeMessage(hash, realMessage.id, realMessage.user, realMessage.room, realMessage.createdTime);
            fakeMessages.push(message.sanitized());
        }
        connection.send('messages', fakeMessages);
    }

    /**
     * Build a fake message
     * @param hash Hash to randomize the message content and stickers
     * @param id
     * @param user
     * @param room
     * @param createdTime
     * @returns
     */
    getFakeMessage(hash: number, id: number, user: User, room?: number | null, createdTime?: Date): Message {
        hash = Math.floor(hash);
        const stickers = Object.keys(StickerManager.stickers);
        const fakeTextIndex = hash % Config.FAKE_MESSAGES.length;
        const addSticker = hash % 4 === 0;
        const stickerIndex = hash % stickers.length;
        const content = Config.FAKE_MESSAGES[fakeTextIndex] + (addSticker ? ' ' + stickers[stickerIndex] : '');

        return new Message({
            id,
            user,
            room,
            content: content,
            createdTime: createdTime || new Date(),
        });
    }
}
