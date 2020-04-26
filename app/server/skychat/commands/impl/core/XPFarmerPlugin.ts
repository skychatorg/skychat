import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {Room} from "../../../Room";
import {User} from "../../../User";
import {ConnectedListPlugin} from "./ConnectedListPlugin";
import {UserController} from "../../../UserController";


export class XPFarmerPlugin extends Plugin {

    public static readonly MAX_INACTIVITY_DURATION_MS: number = 10 * 60 * 1000;

    readonly name = 'xpfarmer';

    readonly minRight = -1;

    readonly callable = false;

    constructor(room: Room) {
        super(room);

        if (this.room) {
            setInterval(this.tick.bind(this), 60 * 1000);
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> { }

    private async tick(): Promise<void> {
        // Get rooms in the session
        const sessions = Array.from(new Set(this.room.connections.map(connection => connection.session)));
        // For each session in the room
        for (const session of sessions) {
            // If it's not a logged session, continue
            if (session.user.right < 0) {
                continue;
            }
            // If user inactive for too long, continue
            if (session.lastMessageDate.getTime() + XPFarmerPlugin.MAX_INACTIVITY_DURATION_MS < new Date().getTime()) {
                continue;
            }

            await UserController.giveXP(session.user, 1);
        }
        await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
