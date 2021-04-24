import {Connection} from "../../Connection";
import {Plugin} from "../../Plugin";


export class VoidPlugin extends Plugin {

    readonly name = 'void';
    readonly minRight = -1;
    readonly hidden = true;
    async run(alias: string, param: string, connection: Connection): Promise<void> { }
}
