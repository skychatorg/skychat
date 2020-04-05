import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {SanitizedUser} from "../../User";
import {Room} from "../../Room";


/**
 * Handle the list of currently active connections
 */
export class ConnectedListPlugin extends Plugin {

    readonly name = 'connectedlist';

    readonly minRight = -1;

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
        const connectedList: SanitizedUser[] = [];
        for (let connection of this.room.connections) {
            const user = connection.session.user;
            if (connectedList.indexOf(user) !== -1) {
                continue;
            }
            connectedList.push(user.sanitized());
        }
        this.room.send('connected-list', connectedList);
    }
}
