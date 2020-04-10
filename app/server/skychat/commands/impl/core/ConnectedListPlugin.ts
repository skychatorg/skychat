import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {SanitizedUser} from "../../../User";
import {Room} from "../../../Room";
import {SanitizedSession} from "../../../Session";


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
            setInterval(this.tick.bind(this), 10 * 1000);
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
        const sessions: {[identifier: string]: SanitizedSession} = {};
        for (let connection of this.room.connections) {
            if (typeof sessions[connection.session.identifier] !== 'undefined') {
                continue;
            }
            sessions[connection.session.identifier] = connection.session.sanitized();
        }
        this.room.send('connected-list', Object.values(sessions).sort((a, b) => b.user.right - a.user.right));
    }
}
