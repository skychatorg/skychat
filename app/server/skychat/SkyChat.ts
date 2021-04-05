import {Server} from "./Server";
import {Connection} from "./Connection";
import * as http from "http";
import {Session} from "./Session";
import {DatabaseHelper} from "./DatabaseHelper";
import {User} from "./User";
import * as iof from "io-filter";
import {Room, StoredRoom} from "./Room";
import {CommandManager} from "./commands/CommandManager";
import {UserController} from "./UserController";
import {Config} from "./Config";
import * as fs from "fs";
import {Message} from "./Message";
import {AudioRecorderPlugin} from "./commands/impl/core/AudioRecorderPlugin";


export type StoredSkyChat = {
    guestId: number;
    messageId: number;
}

/**
 * The base server class for the skychat
 */
export class SkyChat {

    public static readonly STORAGE_BASE_PATH: string = 'storage/skychat.json';

    private static TICK_INTERVAL: number = 5 * 1000;

    private static CURRENT_GUEST_ID: number = 0;

    private readonly room: Room = new Room(0);

    private readonly server: Server;

    constructor() {

        // Try to load this instance's settings from storage
        this.load();

        // Create server instance
        this.server = new Server(this.getNewSession.bind(this));

        // Register hooks
        this.server.onConnectionCreated = this.onConnectionCreated.bind(this);

        // Load database then register server events
        DatabaseHelper
            .load()
            .then(async () => {

                await this.room.loadLastMessagesFromDB();

                // On register
                this.server.registerEvent('register', this.onRegister.bind(this), new iof.ObjectFilter({
                    username: new iof.RegExpFilter(User.USERNAME_LOGGED_REGEXP),
                    password: new iof.RegExpFilter(/^.{4,512}$/),
                }));

                // Login by username & password
                this.server.registerEvent('login', this.onLogin.bind(this), new iof.ObjectFilter({
                    username: new iof.RegExpFilter(User.USERNAME_LOGGED_REGEXP),
                    password: new iof.RegExpFilter(/^.{4,512}$/),
                }));

                // Login using token
                this.server.registerEvent('set-token', this.onSetToken.bind(this), new iof.ObjectFilter({
                    userId: new iof.NumberFilter(1, Infinity, false),
                    timestamp: new iof.NumberFilter(- Infinity, Infinity, false),
                    signature: new iof.ValueTypeFilter('string'),
                }));

                // Join a room
                this.server.registerEvent('join-room', this.onJoinRoom.bind(this), new iof.ObjectFilter({
                    roomId: new iof.NumberFilter(0, 0, false),
                }));

                // On message sent
                this.server.registerEvent('message', this.onMessage.bind(this), 'string');

                // On audio received
                this.server.registerEvent('audio', this.onAudio.bind(this));
            });

        setInterval(this.tick.bind(this), SkyChat.TICK_INTERVAL);
    }

    /**
     * Try to load this room's data from disk
     */
    private load(): void {
        try {

            // Load data from disk
            const data = JSON.parse(fs.readFileSync(SkyChat.STORAGE_BASE_PATH).toString()) as StoredSkyChat;
            SkyChat.CURRENT_GUEST_ID = data.guestId || 0;
            Message.ID = data.messageId || 0;

        } catch (e) {

            // If an error happens, reset this room's storage
            this.save();
        }
    }

    /**
     * Save this room's data to disk
     */
    private save(): boolean {
        try {
            // Build storage object
            const data: StoredSkyChat = {
                guestId: SkyChat.CURRENT_GUEST_ID,
                messageId: Message.ID
            };

            fs.writeFileSync(SkyChat.STORAGE_BASE_PATH, JSON.stringify(data));
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Clean-up function, executed once in a while
     */
    private tick(): void {
        this.save();
    }

    /**
     * Build a new session object when there is a new connection
     */
    private async getNewSession(request: http.IncomingMessage): Promise<Session> {
        if (SkyChat.CURRENT_GUEST_ID >= Math.pow(10, 10)) {
            SkyChat.CURRENT_GUEST_ID = 0;
        }
        const guestId = ++ SkyChat.CURRENT_GUEST_ID;
        const randomName = Config.getRandomGuestName();
        const identifier = '*' + randomName + '#' + guestId;
        const session = new Session(identifier);
        session.user.data.plugins.avatar = 'https://eu.ui-avatars.com/api/?name=' + randomName;
        return session;
    }

    /**
     * Called each time a new connection is created
     * @param connection
     */
    private async onConnectionCreated(connection: Connection): Promise<void> {
        connection.send('config', Config.toClient());
    }

    private async onRegister(payload: any, connection: Connection): Promise<void> {
        await UserController.registerUser(payload.username, payload.password);
        await this.onAuthSuccessful(payload.username, connection);
    }

    private async onLogin(payload: any, connection: Connection): Promise<void> {
        const user = await UserController.login(payload.username, payload.password);
        await this.onAuthSuccessful(payload.username, connection);
    }

    private async onSetToken(payload: any, connection: Connection): Promise<void> {
        try {
            const user = await UserController.verifyAuthToken(payload);
            await this.onAuthSuccessful(user.username, connection);
        } catch (e) {
            connection.send('auth-token', null);
        }
    }

    private async onJoinRoom(payload: {roomId: number}, connection: Connection): Promise<void> {
        await this.room.attachConnection(connection);
    }

    /**
     * When an auth attempt is completed
     * @param username
     * @param connection
     */
    private async onAuthSuccessful(username: string, connection: Connection): Promise<void> {
        // Find an existing session belonging to the same user
        const recycledSession = Session.getSessionByIdentifier(username.toLowerCase());
        let user;
        if (recycledSession) {
            // If such session exists, attach the recycled one
            user = recycledSession.user;
            await UserController.changeUsernameCase(user, username);
            recycledSession.attachConnection(connection);
        } else {
            // Else, update this session
            user = await UserController.getUserByUsername(username);
            if (! user) {
                throw new Error('User does not exist');
            }
            await UserController.changeUsernameCase(user, username);
            connection.session.setUser(user);
        }
        connection.send('auth-token', UserController.getAuthToken(user.id));
        await this.room.attachConnection(connection);
        await this.room.executeConnectionAuthenticated(connection);
    }

    /**
     * When a message is received
     * @param payload
     * @param connection
     */
    private async onMessage(payload: string, connection: Connection): Promise<void> {

        // Apply hooks on payload
        if (! connection.room) {
            throw new Error('Messages event should be sent in rooms');
        }

        // Handle default command (/message)
        if (payload[0] !== '/') {
            payload = '/message ' + payload;
        }

        payload = await connection.room.executeNewMessageHook(payload, connection);

        // Parse command name and message content
        const {param, commandName} = CommandManager.parseMessage(payload);

        // Get command object
        const command = connection.room.commands[commandName];
        if (! command) {
            throw new Error('This command does not exist');
        }

        await command.execute(commandName, param, connection);
    }

    /**
     * When an audio buffer is received
     * @param buffer 
     */
    private async onAudio(buffer: Buffer, connection: Connection): Promise<void> {

        if (! connection.room) {
            throw new Error('Audio recordings should be sent in rooms');
        }
        
        const audioRecorderPlugin = connection.room.getPlugin('audio') as AudioRecorderPlugin;
        await audioRecorderPlugin.registerAudioBuffer(buffer, connection);
    }
}

