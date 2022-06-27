import { Connection } from "../../../skychat/Connection";
import { Session } from "../../../skychat/Session";
import { Config } from "../../../skychat/Config";
import { GlobalPlugin } from "../../GlobalPlugin";
import { RoomManager } from "../../../skychat/RoomManager";


/**
 * Handle the list of currently active connections
 */
export class ConnectedListPlugin extends GlobalPlugin {

    /**
     * Maximum interval between two syncs, to ensure data is consistent on the client-side
     */
    static readonly MAX_SYNC_DELAY = 30 * 1000;

    /**
     * Minimum interval between two syncs, to save bandwidth
     */
    static readonly MIN_SYNC_DELAY = 3 * 1000;

    static readonly commandName = 'connectedlist';

    readonly opOnly = true;

    protected storage: {mode: 'show-all' | 'hide-details-by-right', argument: number} = {
        mode: 'show-all',
        argument: 0,
    };

    readonly rules = {
        connectedlist: {
            minCount: 1,
            params: [{name: 'mode', pattern: /^(show-all|hide-details-by-right)$/}, {name: 'argument', pattern: /^([0-9]+)$/}]
        }
    }

    /**
     * Debounced timeout to send a sync command to clients
     */
    syncDebouncedTimeout: NodeJS.Timeout | null = null;

    /**
     * Last date when clients were synchronized
     */
    syncLastDate: Date = new Date();

    constructor(manager: RoomManager) {
        super(manager);

        this.loadStorage();
        setInterval(this.tick.bind(this), ConnectedListPlugin.MAX_SYNC_DELAY);
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Update storage value
        const [mode, arg]: string[] = param.split(' ');
        this.storage = {
            mode: mode as 'show-all'|'hide-details-by-right',
            argument: parseInt(arg)
        };
        this.syncStorage();

        this.sync();
    }

    async onConnectionAuthenticated(connection: Connection): Promise<void> {
        this.sync();
    }

    async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        this.sync();
    }

    async onConnectionLeftRoom(connection: Connection): Promise<void> {
        this.sync();
    }

    private tick(): void {

        // If last sync was long ago, we make a sync request
        if (this.syncLastDate.getTime() + ConnectedListPlugin.MIN_SYNC_DELAY < new Date().getTime()) {
            this._syncNow();
            return;
        }
    }

    public sync(): void {

        // If last sync was long ago, we can sync directly
        if (this.syncLastDate.getTime() + ConnectedListPlugin.MIN_SYNC_DELAY < new Date().getTime()) {
            this._syncNow();
            return;
        }

        // Cancel old re-sync request if any and create request to re-sync when enough time has passed
        if (this.syncDebouncedTimeout) {
            clearTimeout(this.syncDebouncedTimeout);
        }
        const timeSinceLastSync = new Date().getTime() - this.syncLastDate.getTime();
        const remainingWaitTime = ConnectedListPlugin.MIN_SYNC_DELAY - timeSinceLastSync;
        this.syncDebouncedTimeout = setTimeout(this._syncNow.bind(this), remainingWaitTime);
    }

    private _syncNow() {

        this.syncLastDate = new Date();

        // Build a list of anon sessions to send to guests
        let anonSessions =  Object.values(Session.sessions)
            .map(sess => sess.sanitized())
            .map(sess => ({...sess, user: { ...sess.user, money: 0, right: -1, xp: 0 }}))
            .sort((a, b) => {
                if (a.connectionCount === 0 || b.connectionCount === 0) {
                    return b.connectionCount - a.connectionCount;
                }
                return a.user.username.localeCompare(b.user.username);
            });

        // Real session list
        let realSessions = Object.values(Session.sessions)
            .map(sess => sess.sanitized())
            .sort((a, b) => {
                if (a.connectionCount === 0 || b.connectionCount === 0) {
                    return b.connectionCount - a.connectionCount;
                }
                if (a.user.right !== b.user.right) {
                    return b.user.right - a.user.right;
                }
                return b.user.xp - a.user.xp;
            });
            
        Object.values(Session.sessions).forEach(session => {
            session.connections.forEach(connection => {

                if (connection.session.user.right < Config.PREFERENCES.minRightForConnectedList) {
                    return;
                }
                
                if (this.storage.mode === 'hide-details-by-right' && connection.session.user.right < this.storage.argument) {
                    connection.send('connected-list', anonSessions);
                } else {
                    connection.send('connected-list', realSessions);
                }
            });
        });
    }
}
