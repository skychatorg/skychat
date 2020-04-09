import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {Room} from "../../Room";
import {User} from "../../User";
import {ConnectedListPlugin} from "./ConnectedListPlugin";
import {UserController} from "../../UserController";


export class PointFarmerPlugin extends Plugin {

    public static readonly MAX_INACTIVITY_DURATION_MS: number = 5 * 60 * 1000;

    readonly name = 'points';

    readonly minRight = -1;

    readonly callable = false;

    constructor(room: Room) {
        super(room);

        if (this.room) {
            setInterval(this.tick.bind(this), 60 * 1000);
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
            // If user inactive for too long, continue
            if (session.lastMessageDate.getTime() + PointFarmerPlugin.MAX_INACTIVITY_DURATION_MS < new Date().getTime()) {
                continue;
            }
            // Give 0.01$ to this brave man
            session.user.money ++;
            await UserController.sync(session.user);
        }
        await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
