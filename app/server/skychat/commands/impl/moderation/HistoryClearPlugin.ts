import {Command} from "../../Command";
import {Connection} from "../../../Connection";
import {MessageFormatter} from "../../../MessageFormatter";
import {Config} from "../../../Config";
import {User} from "../../../User";
import {UserController} from "../../../UserController";


export class HistoryClearPlugin extends Command {

    readonly name = 'historyclear';

    readonly aliases = ['hc'];

    readonly minRight = 10;

    readonly rules = {
        historyclear: {coolDown: 10000,},
        hc: {coolDown: 10000,},
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        await UserController.buy(connection.session.user, 100);
        this.room.clearHistory();
    }
}
