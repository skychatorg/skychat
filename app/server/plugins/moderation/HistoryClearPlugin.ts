import { Connection } from "../../skychat/Connection";
import { UserController } from "../../skychat/UserController";
import { RoomPlugin } from "../../skychat/RoomPlugin";


export class HistoryClearPlugin extends RoomPlugin {

    static readonly commandName = 'historyclear';

    static readonly commandAliases = ['hc'];

    readonly opOnly = true;

    readonly rules = {
        historyclear: {coolDown: 10000,},
        hc: {coolDown: 10000,},
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        await UserController.buy(connection.session.user, 100);
        this.room.clearHistory();
    }
}
