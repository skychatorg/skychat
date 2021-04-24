import {Connection} from "../../Connection";
import {User} from "../../User";
import {Session} from "../../Session";
import { Room } from "../../Room";
import { Plugin } from "../../Plugin";
import fetch from "node-fetch";


export class TorBanPlugin extends Plugin {

    static readonly CHECK_TOR_URL = 'https://check.torproject.org/torbulkexitlist';

    static readonly UPDATE_TOR_EXIT_NODES_INTERVAL = 6 * 60 * 60 * 1000;

    readonly name = 'torban';

    public torExitNodes: string[] = [];

    public readonly callable = false;
    //public readonly minRight = 100;
    //public readonly opOnly = true;
    public readonly hidden = true;

    constructor(room: Room) {
        super(room);

        if (this.room) {
            setInterval(this.updateTorExitNodesList.bind(this), TorBanPlugin.UPDATE_TOR_EXIT_NODES_INTERVAL);
            this.updateTorExitNodesList();
        }
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
