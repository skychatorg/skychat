import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {Room} from "../../../Room";
import {Session} from "../../../Session";


/**
 * Handle the list of currently active connections
 */
export class ConnectedListPlugin extends Plugin {

    readonly name = 'connectedlist';

    readonly minRight = 100;

    readonly callable = true;
    
    protected storage: {mode: 'show-all' | 'hide-by-right', argument: number} = {
        mode: 'show-all',
        argument: 0,
    };

    readonly rules = {
        connectedlist: {
            minCount: 1,
            params: [{name: 'mode', pattern: /^(show-all|hide-by-right)$/}, {name: 'argument', pattern: /^([0-9]+)$/}]
        }
    }

    constructor(room: Room) {
        super(room);

        if (this.room) {
            this.loadStorage();
            setInterval(this.tick.bind(this), 6 * 1000);
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Update storage value
        const [mode, arg]: string[] = param.split(' ');
        this.storage = {
            mode: mode as 'show-all'|'hide-by-right',
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

    async onConnectionClosed(connection: Connection): Promise<void> {
        this.sync();
    }

    private tick(): void {
        this.sync();
    }

    public sync(): void {

        // Build a list of anon sessions to send to guests
        let anonSessions =  Object.values(Session.sessions)
            .map(sess => sess.sanitized())
            .map(sess => ({...sess, user: { ...sess.user, money: 0, right: 0, xp: 0 }}))
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
        
        this.room.connections.forEach(connection => {
            if (this.storage.mode === 'hide-by-right' && connection.session.user.right < this.storage.argument) {
                connection.send('connected-list', anonSessions);
            } else {
                connection.send('connected-list', realSessions);
            }
        });
    }
}
