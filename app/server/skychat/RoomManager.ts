import fs from 'fs';
import { GlobalPlugin } from '../plugins/GlobalPlugin.js';
import { Connection } from './Connection.js';
import { Logging } from './Logging.js';
import { Message } from './Message.js';
import { PluginManager } from './PluginManager.js';
import { Room } from './Room.js';
import { Session } from './Session.js';
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

    readonly pluginManager: PluginManager;

    rooms: Room[] = [];

    constructor(pluginManager: PluginManager) {
        this.pluginManager = pluginManager;

        // Try to load this instance's settings from storage
        // Load rooms from storage
        this.load();

        if (this.rooms.length === 0) {
            this.rooms.push(new Room(this, false));
        }
    }

    async start() {
        // Periodically send the room list to users
        setInterval(() => {
            Object.values(Session.sessions).map((session) => this.sendRoomList(session));
        }, RoomManager.FULL_SYNC_INTERVAL);

        setInterval(this.tick.bind(this), RoomManager.TICK_INTERVAL);

        // Load last messages from all rooms (do not wait on it)
        await Promise.all(this.rooms.map((room) => room.loadLastMessagesFromDB()));

        // Get all user ids from all rooms (and their associated last message date)
        const userIds: Record<number, Date> = {};
        for (const room of this.rooms) {
            for (const message of room.messages) {
                if (message.user.id > 0) {
                    if (userIds[message.user.id] === undefined) {
                        userIds[message.user.id] = message.createdTime;
                    } else if (userIds[message.user.id] < message.createdTime) {
                        userIds[message.user.id] = message.createdTime;
                    }
                }
            }
        }

        // Load all these users
        for (const userId in userIds) {
            const deadDuration = new Date().getTime() - userIds[userId].getTime();
            if (deadDuration > Session.DEAD_USER_SESSION_CLEANUP_DELAY_MS) {
                Logging.info(`User ${userId} is dead since ${userIds[userId]} - Skipping`);
                continue;
            }
            const user = await UserController.getUserById(parseInt(userId));
            const session = await UserController.getOrCreateUserSession(user);
            Logging.info(`Adding user ${session.identifier} (${user.id}) to the session list (last message date: ${userIds[userId]})`);
            session.deadSince = userIds[userId];
        }
    }

    /**
     * Try to load the room manager data from disk
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
        Logging.info(`Lodaded ${rooms.length} rooms from storage`);
        this.rooms = rooms
            .map((id) => {
                Logging.info(`Loading room ${id}`);
                try {
                    return new Room(this, false, id);
                } catch (e) {
                    Logging.error(`Error loading room ${id}: ${e}`);
                    return null;
                }
            })
            .filter((room) => room !== null) as Room[];
    }

    /**
     * Save the room manager data to disk
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
    }

    /**
     * Returns whether a room id exists
     */
    hasRoomId(id: number): boolean {
        return !!this.rooms.find((room) => room.id === id);
    }

    /**
     * Get a room by id
     */
    getRoomById(id: number): Room | null {
        return this.rooms.find((room) => room.id === id) || null;
    }

    findSuitableRoom(connection: Connection) {
        return this.rooms.find((room) => room.accepts(connection.session));
    }

    /**
     * Create a new room
     */
    createRoom(name?: string) {
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
     */
    findPrivateRoom(usernames: string[]): Room | null {
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
     */
    createPrivateRoom(usernames: string[]) {
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
     */
    async deleteRoom(id: number) {
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
    async reOrderRooms(order: number[]) {
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
     * Convenience method for plugins to use
     */
    getPlugin(commandName: string): GlobalPlugin {
        return this.pluginManager.getCommand(commandName);
    }

    /**
     * Get a sorted list of rooms
     */
    getSortedRoomList(): Room[] {
        const publicRooms = this.rooms.filter((room) => !room.isPrivate);
        const privateRooms = this.rooms.filter((room) => room.isPrivate);

        // Sort public rooms by order only
        publicRooms.sort((a, b) => b.order - a.order);

        // Sort private rooms by last message date (most recent first)
        privateRooms.sort((a, b) => b.getLastReceivedMessageDate().getTime() - a.getLastReceivedMessageDate().getTime());

        return [...publicRooms, ...privateRooms];
    }

    /**
     * Send the list of rooms for a specific connection
     * @param connection
     */
    sendRoomList(connectionOrSession: Connection | Session) {
        // Get the session object
        const session = connectionOrSession instanceof Connection ? connectionOrSession.session : connectionOrSession;
        connectionOrSession.send(
            'room-list',
            this.getSortedRoomList()
                .filter((room) => !room.isPrivate || room.whitelist.indexOf(session.identifier) !== -1)
                .map((room) => room.sanitized()),
        );
    }

    /**
     * Called each time a new connection is created
     */
    async onConnectionCreated(connection: Connection): Promise<void> {
        this.sendRoomList(connection);
    }
}
