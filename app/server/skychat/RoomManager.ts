import fs from 'fs';
import * as iof from 'io-filter';
import { GlobalPlugin } from '../plugins/GlobalPlugin.js';
import { globalPluginGroup } from '../plugins/GlobalPluginGroup.js';
import { Config } from './Config.js';
import { Connection } from './Connection.js';
import { Message } from './Message.js';
import { MessageFormatter } from './MessageFormatter.js';
import { Room } from './Room.js';
import { Server } from './Server.js';
import { Session } from './Session.js';
import { User } from './User.js';
import { UserController } from './UserController.js';

export type StoredSkyChat = {
    guestId: number;
    messageId: number;
    roomId: number;
    rooms: number[];
};

/**
 * The room manager
 */
export class RoomManager {
    static readonly STORAGE_MAIN_FILE: string = 'storage/main.json';

    private static TICK_INTERVAL: number = 5 * 1000;

    private static FULL_SYNC_INTERVAL = 60 * 1000;

    private static CURRENT_GUEST_ID = 0;

    private readonly server: Server;

    rooms: Room[] = [];

    /**
     * Plugins. All aliases of a command/plugin points to the same command instance.
     */
    commands: { [commandName: string]: GlobalPlugin } = {};

    /**
     * Plugins
     */
    plugins: GlobalPlugin[] = [];

    constructor() {
        // Create server instance
        this.server = new Server(this.getNewSession.bind(this));

        // Try to load this instance's settings from storage
        // Load rooms from storage
        this.load();

        if (this.rooms.length === 0) {
            this.rooms.push(new Room(this, false));
        }

        // Load last messages from all rooms (do not wait on it)
        Promise.all(this.rooms.map((room) => room.loadLastMessagesFromDB()));

        // Load global plugins
        this.plugins = globalPluginGroup.instantiateGlobalPlugins(this);
        this.commands = globalPluginGroup.extractCommandObjectFromPlugins(this.plugins) as { [commandName: string]: GlobalPlugin };

        // Register hooks
        this.server.onConnectionCreated = this.onConnectionCreated.bind(this);

        // On register
        this.server.registerEvent(
            'register',
            this.onRegister.bind(this),
            500,
            2, // 0.5 second cooldown, max 2 attempts / minute
            new iof.ObjectFilter({
                username: new iof.RegExpFilter(User.USERNAME_LOGGED_REGEXP),
                password: new iof.RegExpFilter(/^.{4,512}$/),
            }),
        );

        // Login by username & password
        this.server.registerEvent(
            'login',
            this.onLogin.bind(this),
            500,
            5, // 0.5 second cooldown, max 5 attempts / minute
            new iof.ObjectFilter({
                username: new iof.RegExpFilter(User.USERNAME_LOGGED_REGEXP),
                password: new iof.RegExpFilter(/^.{4,512}$/),
            }),
        );

        // Login using token
        this.server.registerEvent(
            'set-token',
            this.onSetToken.bind(this),
            0,
            30, // no cooldown, max 30 attemtps / minute
            new iof.ObjectFilter({
                userId: new iof.NumberFilter(1, Infinity, false),
                timestamp: new iof.NumberFilter(-Infinity, Infinity, false),
                signature: new iof.ValueTypeFilter('string'),
                roomId: new iof.NumberFilter(0, Infinity, false),
            }),
        );

        // Join a room
        this.server.registerEvent(
            'join-room',
            this.onJoinRoom.bind(this),
            0,
            120,
            new iof.ObjectFilter({ roomId: new iof.NumberFilter(0, Infinity, false) }),
        );

        // On message sent
        this.server.registerEvent('message', this.onMessage.bind(this), 0, Infinity, 'string');

        // On audio received
        this.server.registerEvent(
            'binary-message',
            this.onBinaryMessage.bind(this),
            0,
            180,
            new iof.ObjectFilter({ type: new iof.NumberFilter(0, Infinity, false), data: new iof.ValueTypeFilter('object') }),
        );

        // Periodically send the room list to users
        setInterval(() => {
            Object.values(Session.sessions).map((session) => this.sendRoomList(session));
        }, RoomManager.FULL_SYNC_INTERVAL);

        setInterval(this.tick.bind(this), RoomManager.TICK_INTERVAL);
    }

    /**
     * Try to load this room's data from disk
     */
    private load(): void {
        if (!fs.existsSync(RoomManager.STORAGE_MAIN_FILE)) {
            this.save();
            return;
        }

        // Load data from disk
        const data = JSON.parse(fs.readFileSync(RoomManager.STORAGE_MAIN_FILE).toString()) as StoredSkyChat;

        // Register ids
        RoomManager.CURRENT_GUEST_ID = data.guestId || 0;
        Message.ID = data.messageId || 0;
        Room.CURRENT_ID = data.roomId || 1;

        // Create rooms
        const rooms = data.rooms || [1];
        this.rooms = rooms.map((id) => new Room(this, false, id));
    }

    /**
     * Save this room's data to disk
     */
    private save(): boolean {
        try {
            // Build storage object
            const data: StoredSkyChat = {
                guestId: RoomManager.CURRENT_GUEST_ID,
                messageId: Message.ID,
                roomId: Room.CURRENT_ID,
                rooms: this.rooms.map((room) => room.id),
            };

            fs.writeFileSync(RoomManager.STORAGE_MAIN_FILE, JSON.stringify(data));
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
        this.server.cleanup();
    }

    /**
     * Returns whether a room id exists
     * @param id
     * @returns
     */
    public hasRoomId(id: number): boolean {
        return !!this.rooms.find((room) => room.id === id);
    }

    /**
     * Get a room by id
     * @param id
     * @returns
     */
    public getRoomById(id: number): Room | null {
        return this.rooms.find((room) => room.id === id) || null;
    }

    /**
     * Create a new room
     * @param name
     * @returns
     */
    public createRoom(name?: string) {
        const room = new Room(this);
        if (name) {
            room.name = name;
        }
        this.rooms.push(room);
        Object.values(Session.sessions).forEach((session) => this.sendRoomList(session));
        return room;
    }

    /**
     * Try to find a private room with the exact give participant usernames
     * @param usernames
     * @returns
     */
    public findPrivateRoom(usernames: string[]): Room | null {
        usernames = usernames.sort().map((username) => username.toLowerCase());
        return (
            this.rooms.find((room) => {
                if (!room.isPrivate) {
                    return false;
                }
                if (room.whitelist.length !== usernames.length) {
                    return false;
                }
                for (let i = 0; i < usernames.length; ++i) {
                    if (usernames[i] !== room.whitelist[i]) {
                        return false;
                    }
                }
                return true;
            }) || null
        );
    }

    /**
     * Create a new private room
     * @param usernames
     */
    public createPrivateRoom(usernames: string[]) {
        usernames = usernames.sort();
        const identifiers = usernames.map((username) => username.toLowerCase());
        const room = new Room(this, true);
        identifiers.forEach((identifier) => room.allow(identifier));
        room.name = '';
        this.rooms.push(room);
        identifiers
            .map((identifier) => Session.getSessionByIdentifier(identifier))
            .filter((session) => session instanceof Session)
            .forEach((session) => this.sendRoomList(session as Session));
        return room;
    }

    /**
     * Delete a room
     * @param id
     */
    public async deleteRoom(id: number) {
        if (this.rooms.length === 1) {
            throw new Error('Impossible to remote the last remaining room');
        }
        const room = this.getRoomById(id);
        if (!room) {
            throw new Error(`Room ${id} not found`);
        }
        // Move all connections to another room
        const anyRoom: Room = this.rooms.find((room) => room.id !== id && !room.isPrivate) as Room;
        for (const connection of anyRoom.connections) {
            await anyRoom.attachConnection(connection);
        }
        // Remove old room
        this.rooms = this.rooms.filter((room) => room.id !== id);
        Object.values(Session.sessions).forEach((session) => this.sendRoomList(session));
    }

    /**
     * Reorder public rooms
     */
    public async reOrderRooms(order: number[]) {
        const roomIds = order.filter((roomId) => {
            if (isNaN(roomId)) {
                throw new Error('Invalid room id');
            }
            if (!this.hasRoomId(roomId)) {
                throw new Error(`Room ${roomId} not found`);
            }
            const room = this.getRoomById(roomId);
            if (!room || room.isPrivate) {
                throw new Error(`Room ${roomId} is private`);
            }
            return true;
        });

        // Check there are no duplicates
        if ([...new Set(roomIds)].length !== roomIds.length) {
            throw new Error('Duplicate room ids');
        }

        // Set new order
        for (let i = 0; i < roomIds.length; ++i) {
            const room = this.getRoomById(roomIds[i]);
            if (!room) {
                throw new Error(`Room ${roomIds[i]} not found`);
            }
            room.order = roomIds.length - i;
        }

        // Send room list
        Object.values(Session.sessions).forEach((session) => this.sendRoomList(session));
    }

    /**
     * Build a new session object when there is a new connection
     */
    private async getNewSession(): Promise<Session> {
        if (RoomManager.CURRENT_GUEST_ID >= Math.pow(10, 10)) {
            RoomManager.CURRENT_GUEST_ID = 0;
        }
        const guestId = ++RoomManager.CURRENT_GUEST_ID;
        const randomName = Config.getRandomGuestName();
        const identifier = '*' + randomName + '#' + guestId;
        const session = new Session(identifier);
        session.user.data.plugins.avatar = 'https://eu.ui-avatars.com/api/?name=' + randomName;
        return session;
    }

    /**
     * Get a plugin by its command name
     * @param commandName
     * @returns
     */
    public getPlugin(commandName: string): GlobalPlugin {
        return this.commands[commandName];
    }

    /**
     * Send the list of rooms for a specific connection
     * @param connection
     */
    public sendRoomList(connectionOrSession: Connection | Session) {
        // Get the session object
        const session = connectionOrSession instanceof Connection ? connectionOrSession.session : connectionOrSession;
        connectionOrSession.send(
            'room-list',
            this.rooms
                .filter((room) => !room.isPrivate || room.whitelist.indexOf(session.identifier) !== -1)
                .sort((a, b) => {
                    const getWeight = (room: Room): number => {
                        const privateValue = room.isPrivate ? 0 : 1;
                        const participantCountValue = room.isPrivate ? room.whitelist.length : 1;
                        const score = [privateValue, participantCountValue, room.order, Room.CURRENT_ID - room.id];
                        return score.reduce((a, b) => a * 10000 + b, 0);
                    };
                    return getWeight(b) - getWeight(a);
                })
                .map((room) => room.sanitized()),
        );
    }

    /**
     * Execute new connection hook
     * @param message
     * @param connection
     */
    public async executeNewMessageHook(message: string, connection: Connection): Promise<string> {
        for (const plugin of this.plugins) {
            message = await plugin.onNewMessageHook(message, connection);
        }
        return message;
    }

    /**
     * Execute connection authenticated hook
     * @param connection
     */
    public async executeConnectionAuthenticatedHook(connection: Connection): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onConnectionAuthenticated(connection);
        }
    }

    /**
     * Execute before register hook
     * @param connection
     */
    public async executeBeforeRegisterHook(payload: unknown, connection: Connection): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onBeforeRegister(payload, connection);
        }
    }

    /**
     * Execute connection authenticated hook
     * @param connection
     */
    public async executeNewConnectionHook(connection: Connection): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onNewConnection(connection);
        }
    }

    /**
     * Execute connection closed hook
     * @param connection
     */
    public async executeConnectionClosedHook(connection: Connection): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onConnectionClosed(connection);
        }
    }

    /**
     * Called each time a new connection is created
     * @param connection
     */
    private async onConnectionCreated(connection: Connection): Promise<void> {
        connection.send('config', Config.toClient());
        this.sendRoomList(connection);
        this.executeNewConnectionHook(connection);
        connection.webSocket.on('close', () => {
            this.executeConnectionClosedHook(connection);
        });
    }

    private async onRegister(payload: any, connection: Connection): Promise<void> {
        await this.executeBeforeRegisterHook(payload, connection);
        await UserController.registerUser(payload.username, payload.password);
        await this.onAuthSuccessful(connection, payload.username);
    }

    private async onLogin(payload: any, connection: Connection): Promise<void> {
        await UserController.login(payload.username, payload.password);
        await this.onAuthSuccessful(connection, payload.username);
    }

    private async onSetToken(payload: any, connection: Connection): Promise<void> {
        try {
            const user = await UserController.verifyAuthToken(payload);
            await this.onAuthSuccessful(connection, user.username, payload.roomId);
        } catch (e) {
            connection.send('auth-token', null);
        }
    }

    private async onJoinRoom(payload: { roomId: number }, connection: Connection): Promise<void> {
        if (typeof payload.roomId !== 'number') {
            throw new Error('Invalid room specified');
        }
        const room = this.getRoomById(payload.roomId);
        if (!room) {
            throw new Error('Invalid room specified');
        }
        if (room.isPrivate) {
            if (room.whitelist.indexOf(connection.session.identifier) === -1) {
                throw new Error('You are not allowed to join this room');
            }
        }
        await room.attachConnection(connection);
    }

    /**
     * When an auth attempt is completed
     * @param username
     * @param connection
     */
    private async onAuthSuccessful(connection: Connection, username: string, roomId?: number): Promise<void> {
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
            if (!user) {
                throw new Error('User does not exist');
            }
            await UserController.changeUsernameCase(user, username);
            connection.session.setUser(user);
        }
        connection.send('auth-token', UserController.getAuthToken(user.id));
        this.sendRoomList(connection);
        // Find a room to join
        let room;
        if (typeof roomId === 'number') {
            room = this.getRoomById(roomId);
        }
        room = room ?? this.rooms.find((room) => !room.isPrivate);
        if (room) {
            await room.attachConnection(connection);
            await this.executeConnectionAuthenticatedHook(connection);
            // When session can not be recycled, this means the user was not logged in for a while
            // When this is the case, we will send a message to the room to notify others that the user has logged in
            if (!recycledSession) {
                await room.sendMessage({
                    content: `${user.username} is back online 🙋‍♂️`,
                    user: UserController.getNeutralUser(),
                });
            }
        }
    }

    /**
     * When a message is received
     * @param payload
     * @param connection
     */
    private async onMessage(payload: string, connection: Connection): Promise<void> {
        // Handle default command (/message)
        if (payload[0] !== '/') {
            payload = '/message ' + payload;
        }

        payload = await this.executeNewMessageHook(payload, connection);

        // Parse command name and message content
        const { param, commandName } = MessageFormatter.parseCommand(payload);

        // If command linked to a global plugin
        if (typeof this.commands[commandName] !== 'undefined') {
            const command = this.commands[commandName];
            await command.execute(commandName, param, connection);
            return;
        }

        // If command linked to a room plugin
        if (!connection.room) {
            throw new Error('Messages event should be sent in rooms');
        }

        // Get command object
        if (typeof connection.room.commands[commandName] === 'undefined') {
            throw new Error(`Command '${commandName}' is not provided in this room`);
        }
        const command = connection.room.commands[commandName];

        // Register last session interaction
        connection.session.lastInteractionDate = new Date();

        // Execute the room plugin
        await command.execute(commandName, param, connection);
    }

    private async onBinaryMessage({ type, data }: { type: number; data: Buffer }, connection: Connection): Promise<void> {
        // Try to find a global plugin that wants to handle the binary message
        for (const plugin of this.plugins) {
            if (await plugin.onBinaryDataReceived(connection, type, data)) {
                return;
            }
        }

        // Try to find a room plugin that wants to handle the binary message
        if (connection.room) {
            for (const plugin of connection.room.plugins) {
                if (await plugin.onBinaryDataReceived(connection, type, data)) {
                    return;
                }
            }
        }
    }
}
