import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {Room} from "../../Room";
import {User} from "../../User";
import {ConnectedListPlugin} from "./ConnectedListPlugin";


export class PointFarmerPlugin extends Plugin {

    readonly name = 'points';

    readonly minRight = -1;

    readonly rules = {maxCount: -1};

    constructor(room: Room) {
        super(room);

        if (this.room) {
            setInterval(this.tick.bind(this), 30 * 1000);
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        throw new Error('This plugin is private');
    }

    private async tick(): Promise<void> {
        const users = Array.from(new Set(this.room.connections.map(connection => connection.session.user)));
        for (const user of users) {
            if (user.right < 0) {
                continue;
            }
            user.money ++;
            await User.sync(user);
        }
        await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
