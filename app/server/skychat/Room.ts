import fs from 'fs';
import SQL from 'sql-template-strings';
import { globalPluginGroup } from '../plugins/GlobalPluginGroup.js';
import { RoomPlugin } from '../plugins/RoomPlugin.js';
import { BlacklistPlugin } from '../plugins/core/global/BlacklistPlugin.js';
import { CorePluginGroup } from '../plugins/index.js';
import { RoomProtectPlugin } from '../plugins/security_extra/RoomProtectPlugin.js';
import { Config } from './Config.js';
import { Connection } from './Connection.js';
import { DatabaseHelper } from './DatabaseHelper.js';
import { IBroadcaster } from './IBroadcaster.js';
import { Message, MessageConstructorOptions } from './Message.js';
import { MessageController } from './MessageController.js';
import { RoomManager } from './RoomManager.js';
import { Session } from './Session.js';

export type StoredRoom = {
    name: string;
    order: number;
    pluginGroupNames: string[];
    isPrivate: boolean;
    whitelist: string[];
};

export type SanitizedRoom = {
    id: number;
    name: string;
    isPrivate: boolean;
    whitelist: string[];
    lastReceivedMessageId: number;
    lastReceivedMessageTimestamp: number;
    plugins: { [pluginName: string]: unknown };
};

export class Room implements IBroadcaster {
    /**
     * Base path for rooms persistent storage
     */
    public static readonly STORAGE_BASE_PATH: string = 'storage/rooms';

    /**
     * Room tick duration
     */
    private static TICK_INTERVAL: number = 5 * 1000;

    /**
     * Current global room id
     */
    static CURRENT_ID = 1;

    /**
     * Number of messages kept in memory
     */
    static readonly MESSAGE_HISTORY_LENGTH = 1000;

    /**
     * Number of messages sent to clients that join the room. Must be lower than message history length.
     */
    static readonly MESSAGE_HISTORY_VISIBLE_LENGTH = 25;

    /**
     * Room manager
     */
    public readonly manager: RoomManager;

    /**
     * This room's unique id
     */
    public readonly id: number;

    /**
     * Whether this room's access is based on an identifier whitelist
     */
    public isPrivate: boolean;

    /**
     * This room name
     */
    public name: string;

    /**
     * Room order in the list (only for public rooms)
     */
    public order: number = 0;

    /**
     * List of enabled plugin groups
     */
    public pluginGroupNames: string[] = [];

    /**
     * Connections that are within this room
     */
    public connections: Connection[] = [];

    /**
     * History of the last messages
     */
    public messages: Message[] = [];

    /**
     * Only identifiers in this whitelist can access this room. Only used when isPrivate is set to true.
     */
    public whitelist: string[] = [];

    /**
     * Plugins. All plugin aliases points to the same command plugin instance.
     */
    public readonly commands: { [commandName: string]: RoomPlugin };

    /**
     * Plugins
     */
    public readonly plugins: RoomPlugin[];

    constructor(manager: RoomManager, isPrivate?: boolean, id?: number) {
        this.manager = manager;
        this.isPrivate = !!isPrivate;

        // Find unique room id
        if (typeof id === 'number') {
            this.id = id;
            if (this.id + 1 > Room.CURRENT_ID) {
                Room.CURRENT_ID = this.id + 1;
            }
        } else {
            this.id = Room.CURRENT_ID++;
        }

        // Set default value for stored values then load storage file if it exists (will override default values)
        this.name = `Room ${this.id}`;
        this.pluginGroupNames = [CorePluginGroup.name];
        // We only load non-core plugin groups if not a private room
        if (!this.isPrivate) {
            this.load();
        }

        // Load all plugins
        this.plugins = globalPluginGroup.instantiateRoomPlugins(this);
        this.commands = globalPluginGroup.extractCommandObjectFromPlugins(this.plugins) as { [commandName: string]: RoomPlugin };

        setInterval(this.tick.bind(this), Room.TICK_INTERVAL);
    }

    /**
     * Whether this room can accept a specific connection
     */
    accepts(session: Session): boolean {
        // Private room
        if (this.isPrivate) {
            return this.whitelist.includes(session.identifier);
        }

        // Room protect plugin
        const roomProtectPlugin = this.getPlugin<RoomProtectPlugin>(RoomProtectPlugin.commandName);
        if (roomProtectPlugin) {
            return session.user.right >= roomProtectPlugin.getMinRight();
        }

        return true;
    }

    /**
     * Allow an identifier to access this room (only for private rooms)
     * @param identifier
     */
    public allow(identifier: string): boolean {
        if (!this.isPrivate) {
            throw new Error('Can not whitelist identifier is a non-private room');
        }
        if (this.whitelist.indexOf(identifier) === -1) {
            this.whitelist.push(identifier);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Unallow an identifier to access this room (only for private rooms)
     * @param identifier
     */
    public unallow(identifier: string): boolean {
        if (!this.isPrivate) {
            throw new Error('Can not whitelist identifier is a non-private room');
        }
        const index = this.whitelist.indexOf(identifier);
        if (index === -1) {
            return false;
        }
        this.whitelist.splice(index, 1);
        return true;
    }

    /**
     * Get the sessions that have at least one connection within this room
     */
    public getSessions(): Session[] {
        return Array.from(new Set(this.connections.map((c) => c.session)));
    }

    /**
     * Get this room own storage path
     */
    public getStoragePath(): string {
        return `${Room.STORAGE_BASE_PATH}/${this.id}.json`;
    }

    /**
     * Try to load this room's data from disk storage
     */
    private load(): void {
        // If the storage does not exist, create it
        if (!fs.existsSync(this.getStoragePath())) {
            this.save();
            return;
        }

        // Otherwise, load data from this file
        try {
            const data = JSON.parse(fs.readFileSync(this.getStoragePath()).toString()) as StoredRoom;
            this.name = data.name ?? this.name;
            this.order = data.order ?? this.order;
            this.pluginGroupNames = data.pluginGroupNames ?? this.pluginGroupNames;
            this.isPrivate = !!data.isPrivate;
            this.whitelist = data.whitelist;
        } catch (error) {
            console.error(`Could not load room ${this.id} data from disk: ${error}`);
            this.name = `Room ${this.id} (corrupted)`;
        }
    }

    /**
     * Save this room's data to disk
     */
    private save(): boolean {
        const data: StoredRoom = {
            name: this.name,
            order: this.order,
            pluginGroupNames: this.pluginGroupNames,
            isPrivate: this.isPrivate,
            whitelist: this.whitelist,
        };
        fs.writeFileSync(this.getStoragePath(), JSON.stringify(data));
        return true;
    }

    /**
     * Periodical cleanup/storage of this room data
     */
    private tick(): void {
        this.save();
    }

    /**
     * Load last messages from the database
     */
    public async loadLastMessagesFromDB(): Promise<void> {
        this.messages = (await MessageController.getMessages(['room_id', '=', this.id], 'id DESC', Room.MESSAGE_HISTORY_LENGTH)).sort(
            (m1, m2) => m1.id - m2.id,
        );
    }

    /**
     * Detach a connection from this room
     * @param connection
     */
    public detachConnection(connection: Connection) {
        this.connections = this.connections.filter((c) => c !== connection);
        this.executeOnConnectionLeftRoom(connection);
    }

    /**
     * Attach a connection to this room
     * @param connection
     */
    public async attachConnection(connection: Connection) {
        if (connection.room === this) {
            return;
        }
        // Check it's possible to enter the new room
        await this.executeBeforeConnectionJoinedRoom(connection, this);
        // If this connection was attached to another room
        if (connection.room) {
            // Detach from it
            connection.room.detachConnection(connection);
        }
        // Attach the connection to this room
        connection.setRoom(this);
        this.connections.push(connection);
        await this.executeConnectionJoinedRoom(connection);
    }

    /**
     * Send the history of last messages to a specific connection
     * @param connection
     */
    public sendHistory(connection: Connection, lastId?: number, count?: number): void {
        // Default number of messages to send
        count = count || Room.MESSAGE_HISTORY_VISIBLE_LENGTH;

        // Will start to send messages from this index in this.messages until `count` messages afterwards
        let startFromIndex = Math.max(0, this.messages.length - count);

        // If no lastId is provided, send the last messages
        if (lastId) {
            // Find the message in history whose id is greater than lastId
            const index = this.messages.findIndex((m) => m.id > lastId);
            if (index !== -1) {
                startFromIndex = index - count - 1;
            }
        }

        // Send messages
        const messages = this.messages
            .slice(startFromIndex, startFromIndex + count)
            .filter((message) => {
                // Do not send messages from blacklisted users
                if (
                    Config.PREFERENCES.invertedBlacklist &&
                    BlacklistPlugin.hasBlacklisted(message.user, connection.session.user.username)
                ) {
                    return false;
                }
                return true;
            })
            .map((message) => message.sanitized());

        if (messages.length > 0) {
            connection.send('messages', messages);
        }
    }

    /**
     *
     * @param userId
     */
    public containsUser(userId: number) {
        return this.connections.findIndex((connection) => connection.session.user.id === userId) > -1;
    }

    /**
     * Get a plugin instance by its name
     * @param name
     */
    public getPlugin<T extends RoomPlugin>(name: string): T | undefined {
        return this.commands[name] as T | undefined;
    }

    /**
     * Execute before room join hook
     * @param connection
     */
    public async executeBeforeConnectionJoinedRoom(connection: Connection, room: Room): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onBeforeConnectionJoinedRoom(connection, room);
        }
    }

    /**
     * Execute room join hook
     * @param connection
     */
    public async executeConnectionJoinedRoom(connection: Connection): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onConnectionJoinedRoom(connection);
        }
    }

    /**
     * Execute connection closed hook
     * @param connection
     */
    public async executeOnConnectionLeftRoom(connection: Connection): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onConnectionLeftRoom(connection);
        }
    }

    /**
     * Execute on before mesasge broadcast hooks
     * @param message
     * @param connection
     */
    public async executeOnBeforeMessageBroadcastHook(message: Message, connection?: Connection): Promise<Message> {
        for (const plugin of this.plugins) {
            message = await plugin.onBeforeMessageBroadcastHook(message, connection);
        }
        return message;
    }

    /**
     * Send to all sessions
     * @param event
     * @param payload
     */
    public send(event: string, payload: unknown): void {
        this.connections.forEach((connection) => connection.send(event, payload));
    }

    /**
     * Find a message from history by its unique id. Try to load it from cache, or go find it in database if it does not exist.
     */
    public getMessageById(id: number): Message | null {
        return this.messages.find((message) => message.id === id) || null;
    }

    /**
     * Send a new message to the room
     */
    public getLastSentMessage(): Message | null {
        if (this.messages.length === 0) {
            return null;
        }
        return this.messages[this.messages.length - 1];
    }

    /**
     * Send a new message to the room
     * @param options
     */
    public async sendMessage(options: MessageConstructorOptions & { connection?: Connection }): Promise<Message> {
        options.meta = options.meta || {};
        if (options.connection) {
            options.meta.device = options.connection.device;
        }
        if (typeof options.room === 'undefined') {
            options.room = this.id;
        }
        if (options.room !== this.id) {
            throw new Error(`Trying to send a message with invalid room id ${options.room} in room ${this.id}`);
        }
        let message = new Message(options);
        message = await this.executeOnBeforeMessageBroadcastHook(message, options.connection);
        // Send it to clients
        for (const receiver of this.connections) {
            // If receiver was blacklisted by sender, do not send the message
            if (
                Config.PREFERENCES.invertedBlacklist &&
                options.connection &&
                BlacklistPlugin.hasBlacklisted(options.connection.session.user, receiver.session.user.username)
            ) {
                continue;
            }
            receiver.send('message', message.sanitized());
        }
        // Add it to history
        this.messages.push(message);
        this.messages.splice(0, this.messages.length - Room.MESSAGE_HISTORY_LENGTH);
        // Store it into the database
        const sqlQuery = SQL`insert into messages
            (id, room_id, user_id, quoted_message_id, content, date, ip, storage) values
            (${message.id}, ${this.id}, ${options.user.id}, ${options.quoted ? options.quoted.id : null}, ${message.content}, ${
                message.createdTime
            }, ${options.connection ? options.connection.ip : null}, ${JSON.stringify(message.storage)})`;
        await DatabaseHelper.db.query(sqlQuery);
        // Return created message
        return message;
    }

    /**
     * Clear message history
     */
    public clearHistory(): void {
        this.messages.forEach((message) => {
            message.edit('deleted', '<s>deleted</s>');
            this.send('message-edit', message.sanitized());
        });
    }

    /**
     * Get metadata about this room
     */
    public sanitized(): SanitizedRoom {
        const lastMessage: Message | null = this.messages.length === 0 ? null : this.messages[this.messages.length - 1];
        // Merge summary data from every plugin
        const plugins: { [pluginName: string]: unknown } = {};
        for (const plugin of this.plugins) {
            const summary = plugin.getRoomSummary();
            if (summary === null || typeof summary === 'undefined') {
                continue;
            }
            plugins[plugin.commandName] = summary;
        }
        return {
            id: this.id,
            name: this.name,
            isPrivate: this.isPrivate,
            whitelist: this.whitelist,
            lastReceivedMessageId: lastMessage ? lastMessage.id : 0,
            lastReceivedMessageTimestamp: lastMessage ? lastMessage.createdTime.getTime() : 0,
            plugins,
        };
    }
}
