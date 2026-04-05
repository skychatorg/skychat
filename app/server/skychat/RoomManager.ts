import fs from 'fs';
import { GlobalPlugin } from '../plugins/GlobalPlugin.js';
import { CorePluginGroup } from '../plugins/index.js';
import { Connection } from './Connection.js';
import { DatabaseHelper } from './DatabaseHelper.js';
import { Logging } from './Logging.js';
import { Message } from './Message.js';
import { PluginManager } from './PluginManager.js';
import { Room, StoredRoom } from './Room.js';
import { RoomController } from './RoomController.js';
import { Session } from './Session.js';
import { UserController } from './UserController.js';

type StoredSkyChat = {
    guestId: number;
    messageId: number;
    roomId: number;
    rooms: number[];
};

export class RoomManager {
    private static TICK_INTERVAL: number = 5 * 1000;

    private static FULL_SYNC_INTERVAL = 60 * 1000;

    readonly pluginManager: PluginManager;

    rooms: Room[] = [];

    constructor(pluginManager: PluginManager) {
        this.pluginManager = pluginManager;
    }

    async start() {
        // Load rooms from database (migrating from disk if needed)
        await this.loadFromDB();

        // Ensure at least one room exists
        if (this.rooms.length === 0) {
            const room = await this.createRoom('Room 1');
            room.main = true;
            room.markDirty();
            await room.saveToDB();
        }

        // Periodically send the room list to users
        setInterval(() => {
            Object.values(Session.sessions).map((session) => this.sendRoomList(session));
        }, RoomManager.FULL_SYNC_INTERVAL);

        // Periodically save counters
        setInterval(this.tick.bind(this), RoomManager.TICK_INTERVAL);

        // Load last messages from all rooms
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
     * Load rooms from the database. If the DB is empty and disk files exist, migrate first.
     */
    private async loadFromDB(): Promise<void> {
        const hasRooms = await RoomController.hasRooms();
        const diskFilesExist = fs.existsSync('storage/main.json');

        if (!hasRooms && diskFilesExist) {
            await this.migrateFromDisk();
        } else if (hasRooms && diskFilesExist) {
            throw new Error(
                'Inconsistent state: storage/main.json exists but database already contains rooms. ' +
                    'Remove storage/main.json (and storage/rooms/) if migration already succeeded, ' +
                    'or clear the rooms table to re-migrate.',
            );
        }

        // Load message ID counter
        const messageId = await RoomController.getMessageIdCounter();
        if (messageId !== null) {
            Message.ID = messageId;
        }

        // Load rooms
        const roomRows = await RoomController.getAll();
        Logging.info(`Loading ${roomRows.length} rooms from database`);
        for (const { id, data, createdAt } of roomRows) {
            try {
                const room = await Room.create(this, data, id, createdAt);
                this.rooms.push(room);
            } catch (e) {
                Logging.error(`Error loading room ${id}: ${e}`);
            }
        }
    }

    /**
     * Migrate room data from disk JSON files to the database.
     * Runs in a single transaction for atomicity.
     */
    private async migrateFromDisk(): Promise<void> {
        Logging.info('Migrating room data from disk to database...');

        const raw = fs.readFileSync('storage/main.json').toString();
        const mainData = JSON.parse(raw) as StoredSkyChat;

        const roomIds = mainData.rooms || [1];
        const messageId = mainData.messageId || 0;

        // Run entire migration in a transaction
        await DatabaseHelper.db.query('BEGIN');
        try {
            let migratedCount = 0;
            for (const id of roomIds) {
                const filePath = `storage/rooms/${id}.json`;
                if (!fs.existsSync(filePath)) {
                    Logging.warn(`Room file ${filePath} does not exist, skipping`);
                    continue;
                }

                let data: StoredRoom;
                try {
                    const fileContent = JSON.parse(fs.readFileSync(filePath).toString());
                    const rawWhitelist: string[] = fileContent.whitelist ?? [];
                    data = {
                        name: fileContent.name ?? `Room ${id}`,
                        order: fileContent.order ?? 0,
                        pluginGroupNames: fileContent.pluginGroupNames ?? [CorePluginGroup.name],
                        isPrivate: !!fileContent.isPrivate,
                        whitelist: rawWhitelist.map((w: string) => w.toLowerCase()).sort(),
                        main: !!fileContent.main,
                    };
                } catch (parseErr) {
                    // Abort on any parse failure for active rooms
                    throw new Error(`Failed to parse room file ${filePath}: ${parseErr}`);
                }

                await RoomController.insertForMigration(DatabaseHelper.db, id, data);
                migratedCount++;
            }

            // guestId intentionally not migrated — guest IDs are ephemeral, reset on restart
            await RoomController.saveMessageIdCounterForMigration(DatabaseHelper.db, messageId);
            await DatabaseHelper.db.query('COMMIT');

            // Resync the sequence so the next SERIAL id is correct
            await DatabaseHelper.db.query(`SELECT setval(pg_get_serial_sequence('rooms', 'id'), (SELECT MAX(id) FROM rooms))`);
            Logging.info(`Migration complete: ${migratedCount} rooms migrated to database`);
        } catch (err) {
            await DatabaseHelper.db.query('ROLLBACK');
            throw new Error(`Room migration failed (transaction rolled back): ${err}`);
        }

        // Archive disk files only after successful commit
        try {
            if (fs.existsSync('storage/main.json')) {
                fs.unlinkSync('storage/main.json');
                Logging.info('Removed storage/main.json');
            }
            if (fs.existsSync('storage/rooms')) {
                const archiveName = `storage/rooms-pre-migration-${Date.now()}`;
                fs.renameSync('storage/rooms', archiveName);
                Logging.info(`Archived storage/rooms/ to ${archiveName}/`);
            }
        } catch (cleanupErr) {
            Logging.warn(`Post-migration cleanup failed (non-fatal): ${cleanupErr}`);
        }
    }

    /**
     * Save counters to the database
     */
    private tick(): void {
        RoomController.saveMessageIdCounter(Message.ID).catch((err) => Logging.error(`Failed to save counters: ${err}`));
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
    async createRoom(name?: string): Promise<Room> {
        const data: StoredRoom = {
            name: name || 'New Room',
            order: 0,
            pluginGroupNames: [CorePluginGroup.name],
            isPrivate: false,
            whitelist: [],
            main: false,
        };
        const id = await RoomController.insert(data);
        const room = await Room.create(this, data, id);
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
    async createPrivateRoom(usernames: string[]): Promise<Room> {
        usernames = usernames.sort();
        const identifiers = usernames.map((username) => username.toLowerCase());
        const data: StoredRoom = {
            name: '',
            order: 0,
            pluginGroupNames: [CorePluginGroup.name],
            isPrivate: true,
            whitelist: identifiers,
            main: false,
        };
        const id = await RoomController.insert(data);
        const room = await Room.create(this, data, id);
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
            throw new Error('Impossible to remove the last remaining room');
        }
        const room = this.getRoomById(id);
        if (!room) {
            throw new Error(`Room ${id} not found`);
        }
        // Move all connections to another room
        const fallbackRoom = this.rooms.find((r) => r.id !== id && !r.isPrivate);
        if (!fallbackRoom) {
            throw new Error('No public room available to move connections to');
        }
        for (const connection of [...room.connections]) {
            await fallbackRoom.attachConnection(connection);
        }
        // Clean up the room
        await room.destroy();
        // Remove from in-memory list
        this.rooms = this.rooms.filter((r) => r.id !== id);
        // Soft delete in database
        await RoomController.softDelete(id);
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

        // Set new order and persist
        for (let i = 0; i < roomIds.length; ++i) {
            const room = this.getRoomById(roomIds[i]);
            if (!room) {
                throw new Error(`Room ${roomIds[i]} not found`);
            }
            room.order = roomIds.length - i;
            room.markDirty();
        }
        await Promise.all(roomIds.map((roomId) => this.getRoomById(roomId)!.saveToDB()));

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
