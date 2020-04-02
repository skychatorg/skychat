import {Command} from "../Command";
import {Connection} from "../../Connection";


export class HelpCommand extends Command {

    readonly name = 'help';

    readonly aliases = ['h'];

    readonly minRight = -1;

    /**
     * @TODO
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> {
        throw new Error('Not implemented');
    }
}
