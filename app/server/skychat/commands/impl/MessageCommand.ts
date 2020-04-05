import {Command} from "../Command";
import {Connection} from "../../Connection";
import {Message} from "../../Message";


export class MessageCommand extends Command {

    readonly name = 'message';

    readonly minRight = -1;

    readonly rules = {minCount: 1};

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        let content = param;
        let quoted = null;

        // Parse quote
        const quoteMatch = content.match(/^@([0-9]+)/);
        if (quoteMatch && quoteMatch[1]) {
            const quoteId = parseInt(quoteMatch[1]);
            quoted = this.room.getMessageById(quoteId);
            if (quoted) {
                content = content.slice(quoteMatch[0].length);
            }
        }

        // Send the message to the room
        const message = new Message(content, connection.session.user, quoted);
        this.room.sendMessage(message);
    }
}
