import * as jsondiffpatch from 'jsondiffpatch';
import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { SanitizedSession, Session } from '../../../skychat/Session.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

/**
 * Handle the list of currently active connections
 */
export class ConnectedListPlugin extends GlobalPlugin {
    static readonly SYNC_DELAY = 2 * 1000;

    static readonly commandName = 'connectedlist';

    readonly opOnly = true;

    private diffPatcher: jsondiffpatch.DiffPatcher;

    /**
     * Last connected list sent to clients
     */
    private lastConnectedList: unknown = null;

    constructor(manager: RoomManager) {
        super(manager);

        this.lastConnectedList = this.getConnectedList();
        this.diffPatcher = jsondiffpatch.create({
            objectHash: (obj: any, index?: number | undefined) => (obj as SanitizedSession)?.identifier ?? obj.id ?? index,
        });
        setInterval(this.sync.bind(this), ConnectedListPlugin.SYNC_DELAY);
    }

    public run(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    async onNewConnection(connection: Connection): Promise<void> {
        connection.send('connected-list', this.lastConnectedList);
    }

    async onConnectionLeftRoom(): Promise<void> {
        this.sync();
    }

    public sync(): void {
        this._patchClients();
    }

    private _sessionSortFunction(a: Session, b: Session) {
        const sortArray = (session: Session): Array<number> => [
            session.connections.length > 0 ? 1 : 0,
            session.deadSince ? session.deadSince.getTime() : 0,
            session.user.right,
            session.user.xp,
        ];
        const aArray = sortArray(a);
        const bArray = sortArray(b);
        for (let i = 0; i < aArray.length; ++i) {
            if (aArray[i] !== bArray[i]) {
                return bArray[i] - aArray[i];
            }
        }
        return a.user.username.localeCompare(b.user.username);
    }

    private getConnectedList() {
        return Object.values(Session.sessions)
            .sort(this._sessionSortFunction)
            .map((sess) => sess.sanitized());
    }

    private _patchClients() {
        const realSessions = this.getConnectedList();
        const diff = this.diffPatcher.diff(this.lastConnectedList, realSessions);
        if (typeof diff === 'undefined') {
            return;
        }

        for (const session of Object.values(Session.sessions)) {
            for (const connection of session.connections) {
                if (connection.session.user.right < Config.PREFERENCES.minRightForConnectedList) {
                    continue;
                }

                connection.send('connected-list-patch', diff);
            }
        }

        this.lastConnectedList = realSessions;
    }
}
