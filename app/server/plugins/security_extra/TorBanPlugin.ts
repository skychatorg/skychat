import axios from 'axios';
import { Connection } from '../../skychat/Connection.js';
import { Logging } from '../../skychat/Logging.js';
import { RoomManager } from '../../skychat/RoomManager.js';
import { GlobalPlugin } from '../GlobalPlugin.js';

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

    public run(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    private async updateTorExitNodesList(): Promise<void> {
        try {
            const { data: text } = await axios.request({
                method: 'GET',
                url: TorBanPlugin.CHECK_TOR_URL,
                responseType: 'text',
            });
            const ips = text.trim().split('\n');
            this.torExitNodes = ips;
        } catch (error) {
            Logging.warn(error);
        }
    }

    public async onBeforeConnectionJoinedRoom(connection: Connection): Promise<void> {
        if (this.torExitNodes.indexOf(connection.ip) >= 0) {
            connection.close();
            throw new Error('Error');
        }
    }
}
