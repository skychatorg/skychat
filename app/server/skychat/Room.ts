import {Connection} from "./Connection";
import {IBroadcaster} from "./IBroadcaster";
import {Message, MessageConstructorOptions} from "./Message";
import {Plugin} from "../plugins/Plugin";
import {PluginManager} from "./PluginManager";
import * as fs from "fs";
import SQL from "sql-template-strings";
import {DatabaseHelper} from "./DatabaseHelper";
import { MessageController } from "./MessageController";
import { Config } from "./Config";
import { RoomManager } from "./RoomManager";
import { RoomPlugin } from "../plugins/RoomPlugin";
import { AudioRecorderPlugin } from "../plugins/core/AudioRecorderPlugin";
import { ConnectedListPlugin } from "../plugins/core/ConnectedListPlugin";
import { MessageEditPlugin } from "../plugins/core/MessageEditPlugin";
import { MessageHistoryPlugin } from "../plugins/core/MessageHistoryPlugin";
import { MessagePlugin } from "../plugins/core/MessagePlugin";
import { MessageSeenPlugin } from "../plugins/core/MessageSeenPlugin";
import { RoomManagerPlugin } from "../plugins/core/RoomManagerPlugin";
import { TypingListPlugin } from "../plugins/core/TypingListPlugin";
import { VoidPlugin } from "../plugins/core/VoidPlugin";
import { Session } from "./Session";


export type StoredRoom = {
    name: string;
    enabledPlugins: string[];
    isPrivate: boolean;
    whitelist: string[];
}

export type SanitizedRoom = {
    id: number;
    name: string;
    isPrivate: boolean;
    whitelist: string[];
    lastReceivedMessageId: number;
    lastReceivedMessageTimestamp: number;
    plugins: {[pluginName: string]: any};
}


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
    static CURRENT_ID: number = 1;

    /**
     * Number of messages kept in memory
     */
    static readonly MESSAGE_HISTORY_LENGTH = 1000;

    /**
     * Number of messages sent to clients that join the room. Must be lower than message history length.
     */
    static readonly MESSAGE_HISTORY_VISIBLE_LENGTH = 50;

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
     * List of enabled plugins
     */
    public enabledPlugins: string[] = [];

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
    public readonly commands: {[commandName: string]: RoomPlugin};

    /**
     * Plugins sorted by descending priority
     */
    public readonly plugins: RoomPlugin[];

    constructor(manager: RoomManager, isPrivate?: boolean, id?: number) {
        this.manager = manager;
        this.isPrivate = !! isPrivate;

        // Find unique room id
        if (typeof id === 'number') {
            this.id = id;
            if (this.id + 1 > Room.CURRENT_ID) {
                Room.CURRENT_ID = this.id + 1;
            }
        } else {
            this.id = Room.CURRENT_ID;
            ++ Room.CURRENT_ID;
        }
        
        // Set default value for stored values
        this.name = `Room ${this.id}`;
        this.enabledPlugins = this.getDefaultEnabledPlugins();

        // Load storage file if it exists (will override default values)
        this.load();

        // Instantiate plugins
        let result: {commands: {[commandName: string]: RoomPlugin}, plugins: RoomPlugin[]};
        try {
            result = PluginManager.instantiateRoomPlugins(this);
        } catch (error) {
            console.warn('Unable to load plugins from storage', this.enabledPlugins);
            // Retry with default plugins
            this.enabledPlugins = this.getDefaultEnabledPlugins();
            result = PluginManager.instantiateRoomPlugins(this);
        }
        this.commands = result.commands;
        this.plugins = result.plugins;

        setInterval(this.tick.bind(this), Room.TICK_INTERVAL);
    }

    /**
     * Get the default list of plugins to enable for this room
     * @returns 
     */
    public getDefaultEnabledPlugins(): string[] {
        if (this.isPrivate) {
            return [
                AudioRecorderPlugin.name,
                ConnectedListPlugin.name,
                MessageEditPlugin.name,
                MessageHistoryPlugin.name,
                MessagePlugin.name,
                MessageSeenPlugin.name,
                TypingListPlugin.name,
                RoomManagerPlugin.name,
                VoidPlugin.name,
            ];
        } else {
            return Config.getPlugins().filter(PluginManager.isRoomPlugin);
        }
    }

    /**
     * Allow an identifier to access this room (only for private rooms)
     * @param identifier 
     */
    public allow(identifier: string): boolean {
        if (! this.isPrivate) {
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
        if (! this.isPrivate) {
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
        return Array.from(new Set(this.connections.map(c => c.session)));
    }

    /**
     * Get this room own storage path
     */
    public getStoragePath(): string {
        return `${Room.STORAGE_BASE_PATH}/${this.id}.json`;
    }

    /**
     * Try to load this room's data from disk
     */
    private load(): void {
        // If the storage does not exist, create it
        if (! fs.existsSync(this.getStoragePath())) {
            this.save();
            return;
        }

        // Otherwise, load data from this file
        const data = JSON.parse(fs.readFileSync(this.getStoragePath()).toString()) as StoredRoom;
        this.name = data.name || this.name;
        this.enabledPlugins = data.enabledPlugins || this.enabledPlugins;
        this.isPrivate = !! data.isPrivate;
        this.whitelist = data.whitelist;
    }

    /**
     * Save this room's data to disk
     */
    private save(): boolean {
        const data: StoredRoom = {
            name: this.name,
            enabledPlugins: this.enabledPlugins,
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
        this.messages = (await MessageController.getMessages(
                ['room_id', '=', this.id],
                'id DESC',
                Room.MESSAGE_HISTORY_LENGTH
            )).sort((m1, m2) => m1.id - m2.id);
    }

    /**
     * Detach a connection from this room
     * @param connection
     */
    public detachConnection(connection: Connection) {
        this.connections = this.connections.filter(c => c !== connection);
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
        // If this connection was attached to another room
        if (connection.room) {
            // Detach from it
            connection.room.detachConnection(connection);
        }
        await this.executeBeforeConnectionJoinedRoom(connection);
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
        let startFromIndex = Math.max(0, this.messages.length - 1 - count);

        // If no lastId is provided, send the last messages
        if (lastId) {
            // Find the message in history whose id is greater than lastId
            const index = this.messages.findIndex(m => m.id > lastId);
            if (index !== -1) {
                startFromIndex = index - count - 1;
            }
        }

        // Send messages
        const messages = this.messages
            .slice(startFromIndex, startFromIndex + count)
            .map(message => message.sanitized());

        if (messages.length > 0) {
            connection.send('messages', messages);
        }
    }

    /**
     *
     * @param userId
     */
    public containsUser(userId: number) {
        return this.connections.findIndex(connection => connection.session.user.id === userId) > -1;
    }

    /**
     * Get a plugin instance by its name
     * @param name
     */
    public getPlugin(name: string): Plugin | undefined {
        return this.commands[name];
    }
    
    /**
     * Execute before room join hook
     * @param connection
     */
     public async executeBeforeConnectionJoinedRoom(connection: Connection): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onBeforeConnectionJoinedRoom(connection);
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
    public send(event: string, payload: any): void {
        this.connections.forEach(connection => connection.send(event, payload));
    }

    /**
     * Find a message from history by its unique id. Try to load it from cache, or go find it in database if it does not exist.
     */
    public async getMessageById(id: number): Promise<Message | null> {
        return this.messages.find(message => message.id === id) || null;
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
    public async sendMessage(options: MessageConstructorOptions & {connection?: Connection}): Promise<Message> {
        options.meta = options.meta || {};
        if (options.connection) {
            options.meta.device = options.connection.device;
        }
        if (typeof options.room === "undefined") {
            options.room = this.id;
        }
        if (options.room !== this.id) {
            throw new Error(`Trying to send a message with invalid room id ${options.room} in room ${this.id}`);
        }
        let message = new Message(options);
        message = await this.executeOnBeforeMessageBroadcastHook(message, options.connection);
        // Send it to clients
        this.send('message', message.sanitized());
        // Add it to history
        this.messages.push(message);
        this.messages.splice(0, this.messages.length - Room.MESSAGE_HISTORY_LENGTH);
        // Store it into the database
        const sqlQuery = SQL`insert into messages
            (\`id\`, \`room_id\`, \`user_id\`, \`quoted_message_id\`, \`content\`, \`date\`, \`ip\`) values
            (${message.id}, ${this.id}, ${options.user.id}, ${options.quoted ? options.quoted.id : null}, ${message.content}, ${message.createdTime}, ${options.connection ? options.connection.ip : null})`;
        await DatabaseHelper.db.run(sqlQuery);
        // Return created message
        return message;
    }

    /**
     * Clear message history
     */
    public clearHistory(): void {
        this.messages.forEach(message => {
            message.edit('deleted', `<s>deleted</s>`);
            this.send('message-edit', message.sanitized());
        });
    }

    /**
     * Get metadata about this room
     */
    public sanitized(): SanitizedRoom {
        const lastMessage: Message | null = this.messages.length === 0 ? null : this.messages[this.messages.length - 1];
        // Merge summary data from every plugin
        const plugins: {[pluginName: string]: string} = {};
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
