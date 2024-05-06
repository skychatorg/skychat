import { AuthBridge, ConnectionAcceptedEvent } from './AuthBridge.js';
import { Config } from './Config.js';
import { Connection } from './Connection.js';
import { HttpServer } from './HttpServer.js';
import { PluginManager } from './PluginManager.js';
import { RoomManager } from './RoomManager.js';
import { Session } from './Session.js';
import { User } from './User.js';
import { UserController } from './UserController.js';

export class SkyChatServer {
    private static CURRENT_GUEST_ID = 0;

    private readonly httpServer: HttpServer;

    private readonly authBridge: AuthBridge;

    private readonly pluginManager: PluginManager;

    private readonly roomManager: RoomManager;

    constructor() {
        this.httpServer = new HttpServer();
        this.authBridge = new AuthBridge(this.httpServer);
        this.pluginManager = new PluginManager();
        this.roomManager = new RoomManager(this.pluginManager);
    }

    start() {
        console.log('Starting services');
        this.httpServer.start();
        this.authBridge.start();
        this.pluginManager.start(this.roomManager);
        this.roomManager.start();

        this.authBridge.on('connection-accepted', this.onConnectionAccepted.bind(this));
    }

    private async onConnectionAccepted(event: ConnectionAcceptedEvent) {
        try {
            console.log('Connection accepted', event.user ? event.user.username : '*guest');
            const session = event.user
                ? await this.getUserSession(event.user, event.data.credentials?.username)
                : await this.getNewGuestSession();

            // Create a new connection object & attach it to the session
            const connection = new Connection(session, event.webSocket, event.request);

            // Send config (it should be the first message sent to the client)
            connection.send('config', Config.toClient());

            // Notify the room manager & plugin manager
            this.roomManager.onConnectionCreated(connection);
            this.pluginManager.onConnectionCreated(connection, event);
        } catch (error) {
            console.error(error);
            event.webSocket.send(
                JSON.stringify({
                    event: 'error',
                    data: `${error}`,
                }),
            );
            return;
        }
    }

    private async getUserSession(user: User, usernameWithCustomCase?: string): Promise<Session> {
        const identifier = user.username.toLowerCase();
        const recycledSession = Session.getSessionByIdentifier(identifier);
        if (recycledSession) {
            if (usernameWithCustomCase) {
                await UserController.changeUsernameCase(user, usernameWithCustomCase);
            }
            return recycledSession;
        }
        const newSession = new Session(identifier);
        if (usernameWithCustomCase) {
            await UserController.changeUsernameCase(user, usernameWithCustomCase);
        }
        newSession.setUser(user);
        return newSession;
    }

    /**
     * Build a new session object when there is a new connection
     */
    private async getNewGuestSession(): Promise<Session> {
        // Guest session
        if (SkyChatServer.CURRENT_GUEST_ID >= Math.pow(10, 10)) {
            SkyChatServer.CURRENT_GUEST_ID = 0;
        }
        const guestId = ++SkyChatServer.CURRENT_GUEST_ID;
        const randomName = Config.getRandomGuestName();
        const identifier = '*' + randomName + '#' + guestId;
        const session = new Session(identifier);
        session.user.data.plugins.avatar = 'https://eu.ui-avatars.com/api/?name=' + randomName;
        return session;
    }
}
