import {Command} from "../Command";
import {Connection} from "../../Connection";
import {Message} from "../../Message";


export class MessageCommand extends Command {

    readonly name: string = 'message';

    readonly aliases: string[] = ['m'];

    public readonly minRight: number = -1;

    public readonly roomRequired: boolean = true;

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Create new message
        const message = new Message(param, connection);

        // Send it to the room
        connection.room!.send('message', message.sanitized());
    }
}
