import {Connection} from "../../Connection";
import { Config } from "../../Config";
import { MessageController } from "../../MessageController";
import { Plugin } from "../../Plugin";


export class MessageCommand extends Plugin {

    readonly name = 'message';

    readonly minRight = -1;

    readonly hidden = true;

    readonly rules = {
        message: {minCount: 1}
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
            quoted = quoted || await MessageController.getMessageById(quoteId)
            // If quote found, remote the quote string from the message
            if (quoted) {
                content = content.slice(quoteMatch[0].length);
            }
        }

        // Send the message to the room
        await this.room.sendMessage({
            content,
            user: connection.session.user,
            quoted,
            connection
        });

        // Update the date of the last sent message
        connection.session.lastMessageDate = new Date();
    }
}
