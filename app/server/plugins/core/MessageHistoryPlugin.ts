import {RoomPlugin} from "../../skychat/RoomPlugin";
import {Connection} from "../../skychat/Connection";
import {Message} from "../../skychat/Message";
import {Room} from "../../skychat/Room";
import {Config} from "../../skychat/Config";
import { StickerManager } from "../../skychat/StickerManager";


export class MessageHistoryPlugin extends RoomPlugin {

    static readonly commandName = 'messagehistory';

    readonly hidden = true;

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // If user has the right to access the full history
        if (connection.session.user.right >= Config.PREFERENCES.minRightForMessageHistory) {
            this.room.sendHistory(connection);
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
            const fakeTextIndex = (realMessage.createdTime.getTime() + realMessage.id) % Config.FAKE_MESSAGES.length;
            const addSticker = realMessage.createdTime.getTime() % 4 === 0;
            const stickerIndex = realMessage.createdTime.getTime() % stickers.length;

            // Get the fake message content
            let fakeText = Config.FAKE_MESSAGES[fakeTextIndex];
            // Randomly add a sticker
            if (addSticker) {
                fakeText += ' ' + stickers[stickerIndex];
            }

            // Build the message object and send it
            fakeMessages.push(new Message({
                id: this.room.messages[i].id,
                room: this.room.id,
                content: fakeText,
                createdTime: this.room.messages[i].createdTime,
                user: this.room.messages[i].user
            }).sanitized());

        }
        connection.send('messages', fakeMessages);
    }
}
