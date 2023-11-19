import { RoomPlugin } from '../RoomPlugin';
import { Room } from '../../skychat/Room';
import { Connection } from '../../skychat/Connection';
import { Message } from '../../skychat/Message';
import { UserController } from '../../skychat/UserController';

export type MessageLimit = {
    maxSuccessiveChars: number | null;
};

export class MessageLimiterPlugin extends RoomPlugin {
    static readonly commandName = 'messagelimiter';

    static readonly errorMessage = 'Message limit exceeded (character limit)';

    readonly opOnly = true;

    readonly rules = {
        messagelimiter: {
            minCount: 0,
            maxCount: 1,
            params: [
                {
                    name: 'maxSuccessiveChars',
                    pattern: /^\d+$/,
                },
            ],
        },
    };

    protected storage: MessageLimit = {
        maxSuccessiveChars: null,
    };

    constructor(room: Room) {
        super(room);

        this.loadStorage();
    }

    public getRoomSummary(): null | number {
        return this.storage.maxSuccessiveChars;
    }

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        if (this.room.isPrivate) {
            throw new Error('This command is not available in private rooms');
        }

        const maxSuccessiveChars = parseInt(param);
        this.storage.maxSuccessiveChars = isNaN(maxSuccessiveChars) ? null : maxSuccessiveChars;
        this.syncStorage();

        // Send message to connection
        const message = new Message({
            content: 'Message limit: ' + (this.storage.maxSuccessiveChars === null ? 'off' : this.storage.maxSuccessiveChars),
            user: UserController.getNeutralUser(),
        });
        connection.send('message', message.sanitized());
    }

    public allowMessageEdit(message: Message, newContent: string): boolean {
        // No limit in private rooms
        if (this.room.isPrivate) {
            return true;
        }

        // If no limit
        if (this.storage.maxSuccessiveChars === null) {
            return true;
        }

        // Get last successive messages
        const lastSuccessiveMessages = [];
        let i = this.room.messages.length - 1;
        while (i >= 0 && this.room.messages[i].user.id === message.user.id) {
            lastSuccessiveMessages.push(this.room.messages[i]);
            i--;
        }

        // Is the message to edit part of these successive messages?
        if (!lastSuccessiveMessages.find((m) => m.id === message.id)) {
            return true;
        }

        // Get new successive chars
        let totalChars = 0;
        for (const lastSuccessiveMessage of lastSuccessiveMessages) {
            if (lastSuccessiveMessage.id !== message.id) {
                totalChars += lastSuccessiveMessage.content.length;
            }
        }

        // Check if limit is exceeded
        return totalChars + newContent.length <= this.storage.maxSuccessiveChars;
    }

    public allowNewMessage(message: Message): boolean {
        // No limit in private rooms
        if (this.room.isPrivate) {
            return true;
        }

        // If no limit
        if (this.storage.maxSuccessiveChars === null) {
            return true;
        }

        // Get last successive messages
        let totalChars = 0;
        let i = this.room.messages.length - 1;
        while (i >= 0 && this.room.messages[i].user.id === message.user.id) {
            totalChars += this.room.messages[i].content.length;
            i--;
        }

        // Check if limit is exceeded
        return totalChars + message.content.length <= this.storage.maxSuccessiveChars;
    }

    public async onBeforeMessageBroadcastHook(message: Message): Promise<Message> {
        if (!this.allowNewMessage(message)) {
            throw new Error(MessageLimiterPlugin.errorMessage);
        }

        return message;
    }
}
