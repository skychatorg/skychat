import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {Room} from "../../../Room";
import {Session, SanitizedSession} from "../../../Session";


/**
 * Handle the list of currently active connections
 */
export class ConnectedListPlugin extends Plugin {

    readonly name = 'connectedlist';

    readonly minRight = -1;

    readonly callable = false;

    constructor(room: Room) {
        super(room);

        if (this.room) {
            setInterval(this.tick.bind(this), 6 * 1000);
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> { }

    async onConnectionAuthenticated(connection: Connection): Promise<void> {
        this.sync();
    }

    async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        this.sync();
    }

    async onConnectionClosed(connection: Connection): Promise<void> {
        this.sync();
    }

    private tick(): void {
        this.sync();
    }

    public sync(): void {
        const sessions = Object.values(Session.sessions)
            .map(sess => sess.sanitized())
            .sort((a, b) => a.user.right === b.user.right ? (b.user.xp - a.user.xp) : (b.user.right - a.user.right));
        this.room.send('connected-list', sessions);
    }
}
