import {Command} from "../Command";
import {Connection} from "../../Connection";


export class MessageCommand extends Command {

    readonly name = 'message';

    readonly aliases = ['m'];

    readonly minRight = -1;

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Send the message to the room
        this.room.sendMessage(param, connection.session.user);
    }
}
