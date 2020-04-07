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
        // Get rooms in the session
        const sessions = Array.from(new Set(this.room.connections.map(connection => connection.session)));
        // For each session in the room
        for (const session of sessions) {
            // If it's not a logged session, continue
            if (session.user.right < 0) {
                continue;
            }
            // If user inactive for more than 20min, continue
            if (session.lastMessageDate.getTime() + 60 * 30 * 1000 < new Date().getTime()) {
                continue;
            }
            // Give 0.01$ to this brave man
            session.user.money ++;
            await User.sync(session.user);
        }
        await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
