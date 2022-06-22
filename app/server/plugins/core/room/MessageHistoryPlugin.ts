import { RoomPlugin } from "../../RoomPlugin";
import { Connection } from "../../../skychat/Connection";
import { Message } from "../../../skychat/Message";
import { Room } from "../../../skychat/Room";
import { Config } from "../../../skychat/Config";
import { StickerManager } from "../../../skychat/StickerManager";
import { User } from "../../../skychat/User";


export class MessageHistoryPlugin extends RoomPlugin {

    static readonly commandName = 'messagehistory';

    readonly hidden = true;

    readonly rules = {
        messagehistory: {
            minCount: 0,
            coolDown: 100,
            params: [
                { pattern: /^([0-9]+)$/, name: 'lastId' },
            ]
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // If user has the right to access the full history
        if (connection.session.user.right >= Config.PREFERENCES.minRightForMessageHistory) {
            this.room.sendHistory(connection, parseInt(param) || 0);
            return;
        }

        /**
         * Send the history of last messages to a specific connection
         * @param connection
         */
        // Send message history to the connection that just joined this room
        const fakeMessages = [];
        const stickers = Object.keys(StickerManager.stickers);
        for (let i = Math.max(0, this.room.messages.length - Room.MESSAGE_HISTORY_VISIBLE_LENGTH); i < this.room.messages.length; ++ i) {

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
