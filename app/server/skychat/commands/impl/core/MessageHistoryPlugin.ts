import {Plugin} from "../../Plugin";
import {Connection} from "../../../Connection";
import {Message} from "../../../Message";
import {Room} from "../../../Room";
import {Config} from "../../../Config";
import {MessageFormatter} from "../../../MessageFormatter";


export class MessageHistoryPlugin extends Plugin {

    static readonly FAKE_HISTORY_LENGTH = 32;

    readonly name = 'welcomer';

    readonly hidden = true;

    private readonly formatter: MessageFormatter = MessageFormatter.getInstance();

    async run(alias: string, param: string, connection: Connection): Promise<void> { }

    /**
     * Executed when a connection joins a room
     * @param connection
     */
    public async onConnectionJoinedRoom(connection: Connection): Promise<void> {

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
        const stickers = Object.keys(this.formatter.stickers);
        for (let i = Math.max(0, this.room.messages.length - Room.MESSAGE_HISTORY_VISIBLE_LENGTH); i < this.room.messages.length; ++ i) {

            // Each fake message correspond to a real message
            const realMessage = this.room.messages[i];
            const realMessageHash = realMessage.createdTime.getTime() + realMessage.id;

            // Get the fake message content
            let fakeText = Config.FAKE_MESSAGES[realMessageHash % Config.FAKE_MESSAGES.length];


            // Randomly add a sticker
            if (stickers.length && Math.random() < .7) {
                fakeText += ' ' + stickers[Math.floor(stickers.length * Math.random())];
            }

            // Build the message object and send it
            fakeMessages.push(new Message({id: this.room.messages[i].id, content: fakeText, user: this.room.messages[i].user}).sanitized());

        }
        connection.send('messages', fakeMessages);
    }
}
