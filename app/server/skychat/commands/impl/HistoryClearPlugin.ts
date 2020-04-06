import {Command} from "../Command";
import {Connection} from "../../Connection";


export class HistoryClearPlugin extends Command {

    readonly name = 'historyclear';

    readonly aliases = ['hc'];

    readonly minRight = 10;

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        this.room.messages.forEach(message => {
            message.edit('deleted', `<i>deleted</i>`);
            this.room.send('message-edit', message.sanitized());
        });
        this.room.clearHistory();
    }
}
