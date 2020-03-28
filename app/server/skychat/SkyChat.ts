import {Server} from "../generic-server/Server";
import {Connection} from "../generic-server/Connection";
import * as http from "http";
import {SkyChatSession} from "./SkyChatSession";
import {DatabaseHelper} from "./DatabaseHelper";
import {SkyChatUser} from "./SkyChatUser";
import * as iof from "io-filter";
import {Room} from "../generic-server/Room";
import {Session} from "../generic-server/Session";


/**
 * The base server class for the skychat
 */
export class SkyChat {

    private static CURRENT_GUEST_ID: number = 0;

    private readonly room: Room = new Room();

    private readonly server: Server<SkyChatSession>;

    constructor() {

        // Create server instance
        this.server = new Server({port: 8080}, this.getNewSession);

        // Load database then register server events
        DatabaseHelper
            .load()
            .then(() => {

                // On register
                this.server.registerEvent('register', this.onRegister.bind(this), new iof.ObjectFilter({
                    username: new iof.RegExpFilter(/^[a-zA-Z0-9]{3,16}$/),
                    password: new iof.RegExpFilter(/^.{4,512}$/),
                }));

                // Login by username & password
                this.server.registerEvent('login', this.onLogin.bind(this), new iof.ObjectFilter({
                    username: new iof.RegExpFilter(/^[a-zA-Z0-9]{3,16}$/),
                    password: new iof.RegExpFilter(/^.{4,512}$/),
                }));

                // Login using token
                this.server.registerEvent('set-token', this.onSetToken.bind(this), new iof.ObjectFilter({
                    userId: new iof.NumberFilter(1, Infinity, false),
                    timestamp: new iof.NumberFilter(- Infinity, Infinity, false),
                    signature: new iof.ValueTypeFilter('string'),
                }));

                // On message sent
                this.server.registerEvent('message', this.onMessage.bind(this), 'string');
            });
    }

    /**
     * Get a new username when one connects to the server
     */
    private async getNewSession(request: http.IncomingMessage): Promise<SkyChatSession> {
        const identifier = '*Hamster' + (++ SkyChat.CURRENT_GUEST_ID);
        const session = new SkyChatSession(identifier);
        this.room.attachSession(session);
        return session;
    }

    private async onRegister(payload: any, connection: Connection<SkyChatSession>): Promise<void> {
        const user = await SkyChatUser.registerUser(payload.username, payload.password);
        this.onAuthSuccessful(user, connection);
    }

    private async onLogin(payload: any, connection: Connection<SkyChatSession>): Promise<void> {
        const user = await SkyChatUser.login(payload.username, payload.password);
        this.onAuthSuccessful(user, connection);
    }

    private async onSetToken(payload: any, connection: Connection<SkyChatSession>): Promise<void> {
        const user = await SkyChatUser.verifyAuthToken(payload);
        this.onAuthSuccessful(user, connection);
    }

    /**
     * When an auth attempt is completed
     * @param user
     * @param connection
     */
    private onAuthSuccessful(user: SkyChatUser, connection: Connection<SkyChatSession>): void {
        // Find an existing session belonging to the same user
        const recycledSession = Session.getSessionByIdentifier(user.username.toLowerCase());
        if (recycledSession) {
            // If such session exists, attach this connection to the active session
            recycledSession.attachConnection(connection);
        } else {
            // Else, update this session
            connection.session.setUser(user);
        }
        connection.send('auth-token', SkyChatUser.getAuthToken(user.id));
    }

    private async onMessage(payload: string, connection: Connection<SkyChatSession>): Promise<void> {
        if (! connection.session.room) {
            throw new Error('Join a room before sending a message');
        }
        connection.session.room.send('message', payload);
    }
}
