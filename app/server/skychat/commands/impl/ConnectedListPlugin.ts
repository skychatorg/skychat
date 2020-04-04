import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {SanitizedUser} from "../../User";


/**
 * Handle the list of currently active connections
 */
export class ConnectedListPlugin extends Plugin {

    readonly name = 'connected_list';

    readonly minRight = -1;

    async run(alias: string, param: string, connection: Connection): Promise<void> { }

    async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        this.sync();
    }

    private sync(): void {
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
