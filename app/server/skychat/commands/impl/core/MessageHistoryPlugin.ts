import {Plugin} from "../../Plugin";
import {Connection} from "../../../Connection";
import {Message} from "../../../Message";
import {Room} from "../../../Room";
import {Config} from "../../../Config";
import {MessageFormatter} from "../../../MessageFormatter";


export class MessageHistoryPlugin extends Plugin {

    static readonly MIN_RIGHT_HISTORY = 10;

    static readonly FAKE_HISTORY_LENGTH = 32;

    readonly name = 'welcomer';

    async run(alias: string, param: string, connection: Connection): Promise<void> { }

    /**
     * Executed when a connection joins a room
     * @param connection
     */
    public async onConnectionJoinedRoom(connection: Connection): Promise<void> {

        // If user has the right to access the full history
        if (connection.session.user.right >= MessageHistoryPlugin.MIN_RIGHT_HISTORY) {
            this.room.sendHistory(connection);
            return;
        }

        /**
         * Send the history of last messages to a specific connection
         * @param connection
         */
        // Send message history to the connection that just joined this room
        for (let i = Math.max(0, this.room.messages.length - Room.MESSAGE_HISTORY_VISIBLE_LENGTH); i < this.room.messages.length; ++ i) {

            // Build a fake message
            let fakeText = Config.PREFERENCES.fakeMessages[Math.floor(Math.random() * Config.PREFERENCES.fakeMessages.length)];

            // Randomly add a sticker
            if (Math.random() < .7) {
                const formatter = MessageFormatter.getInstance();
                const stickers = Object.keys(formatter.stickers);
                const sticker = stickers[Math.floor(stickers.length * Math.random())];
                fakeText += ' ' + sticker;
            }

            // Build the message object and send it
            const fakeMessage = new Message(fakeText, null, this.room.messages[i].user, null);
            connection.send('message', fakeMessage.sanitized());
        }
    }
}
