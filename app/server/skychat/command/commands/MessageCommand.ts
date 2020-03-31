import {Command} from "../Command";
import {Connection} from "../../Connection";


export class MessageCommand extends Command {

    readonly name: string = 'message';

    readonly aliases: string[] = ['m'];

    readonly minRight: number = -1;

    readonly roomRequired: boolean = true;

    readonly minParamCount: number = 1;

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Send the message to the room
        connection.room!.sendMessage(param, connection.session.user);
    }
}
