import {Connection} from "../../skychat/Connection";
import {User} from "../../skychat/User";
import {Session} from "../../skychat/Session";
import { Room } from "../../skychat/Room";
import { GlobalPlugin } from "../GlobalPlugin";
import fetch from "node-fetch";
import { RoomManager } from "../../skychat/RoomManager";


export class TorBanPlugin extends GlobalPlugin {

    static readonly CHECK_TOR_URL = 'https://check.torproject.org/torbulkexitlist';

    static readonly UPDATE_TOR_EXIT_NODES_INTERVAL = 6 * 60 * 60 * 1000;

    static readonly commandName = 'torban';

    public torExitNodes: string[] = [];

    readonly callable = false;
    
    public readonly opOnly = true;
    
    public readonly hidden = true;

    constructor(manager: RoomManager) {
        super(manager);

        setInterval(this.updateTorExitNodesList.bind(this), TorBanPlugin.UPDATE_TOR_EXIT_NODES_INTERVAL);
        this.updateTorExitNodesList();
    }

    public run(alias: string, param: string, connection: Connection, session: Session, user: User, room: Room): Promise<void> {
        throw new Error("Method not implemented.");
    }

    private async updateTorExitNodesList(): Promise<void> {
        try {
            const response = await fetch(TorBanPlugin.CHECK_TOR_URL);
            const text = await response.text();
            const ips = text.trim().split("\n");
            this.torExitNodes = ips;
        } catch(error) {
            console.warn(error);
        }
    }

    public async onBeforeConnectionJoinedRoom(connection: Connection): Promise<void> {
        if (this.torExitNodes.indexOf(connection.ip) >= 0) {
            connection.close();
            throw new Error('Error');
        }
    }
}
