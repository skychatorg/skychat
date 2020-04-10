import {Command} from "../../Command";
import {Connection} from "../../../Connection";


export class MessageEditCommand extends Command {

    public static readonly EDIT_ANY_MIN_RIGHT: number = 100;

    readonly name = 'edit';

    readonly aliases = ['delete'];

    readonly minRight = 0;

    readonly rules = {
        edit: {
            minCount: 2,
            coolDown: 100,
            params: [
                {pattern: /^([0-9]+)$/, name: 'id'},
                {pattern: /./, name: 'message'},
            ]
        },
        delete: {
            minCount: 1,
            maxCount: 1,
            coolDown: 100,
            params: [
                {pattern: /^([0-9]+)$/, name: 'id'},
            ]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const id = parseInt(param.split(' ')[0]);

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
        if (alias === 'edit') {
            const content = param.split(' ').slice(1).join(' ');
            message.edit(content);
        } else {
            message.edit('deleted', `<i>deleted</i>`);
        }
        this.room.send('message-edit', message.sanitized());
    }
}
