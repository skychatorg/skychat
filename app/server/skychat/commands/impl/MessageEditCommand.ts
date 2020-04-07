import {Command} from "../Command";
import {Connection} from "../../Connection";


export class MessageEditCommand extends Command {

    public static readonly EDIT_ANY_MIN_RIGHT: number = 100;

    readonly name = 'edit';

    readonly minRight = -1;

    readonly rules = {
        minCount: 2,
        params: [
            {pattern: /^([0-9]+)$/, name: 'id'},
            {pattern: /./, name: 'message'},
        ]
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const id = parseInt(param.split(' ')[0]);
        const content = param.split(' ').slice(1).join(' ');

        // Find message
        const message = this.room.getMessageById(id);
        if (! message) {
            throw new Error('Message not found');
        }

        // Check rights
        if (message.user !== connection.session.user && connection.session.user.right < MessageEditCommand.EDIT_ANY_MIN_RIGHT) {
            throw new Error('You can only edit your own messages');
        }

        // Edit message
        message.edit(content);
        this.room.send('message-edit', message.sanitized());
    }
}
