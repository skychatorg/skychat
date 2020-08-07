import {Connection} from "./Connection";
import {IBroadcaster} from "./IBroadcaster";
import {Message, MessageConstructorOptions, MessageMeta} from "./Message";
import {Command} from "./commands/Command";
import {Plugin} from "./commands/Plugin";
import {CommandManager} from "./commands/CommandManager";
import {User} from "./User";
import * as fs from "fs";
import SQL from "sql-template-strings";
import {DatabaseHelper} from "./DatabaseHelper";


export type StoredRoom = {

}


export class Room implements IBroadcaster {

    /**
     * Base path for rooms persistent storage
     */
    public static readonly STORAGE_BASE_PATH: string = 'storage/rooms';

    /**
     * Number of messages kept in memory
     */
    static readonly MESSAGE_HISTORY_LENGTH = 1000;

    /**
     * Number of messages sent to clients that join the room. Must be lower than message history length.
     */
    static readonly MESSAGE_HISTORY_VISIBLE_LENGTH = 80;

    /**
     * This room's unique id
     */
    public readonly id: number;

    /**
     * Connections that are within this room
     */
    public connections: Connection[] = [];

    /**
     * History of the last messages
     */
    public messages: Message[] = [];

    /**
     * Command instances (including plugins).
     * All aliases of a command/plugin points to the same command instance.
     */
    public readonly commands: {[commandName: string]: Command};

    /**
     * List of loaded plugins
     */
    public readonly plugins: Plugin[];

    constructor(id: number) {
        this.id = id;
        this.commands = CommandManager.instantiateCommands(this);
        this.plugins = CommandManager.extractPlugins(this.commands);
        this.load();
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
        try {

            // Load data from disk
            const data = JSON.parse(fs.readFileSync(this.getStoragePath()).toString()) as StoredRoom;
            // @TODO save room settings

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
            // @TODO build room storage object
            const data: StoredRoom = {};
            fs.writeFileSync(this.getStoragePath(), JSON.stringify(data));
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Detach a connection from this room
     * @param connection
     */
    public detachConnection(connection: Connection) {
        this.connections = this.connections.filter(c => c !== connection);
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
        // Attach the connection to this room
        connection.setRoom(this);
        this.connections.push(connection);
        await this.executeConnectionJoinedRoom(connection);
    }

    /**
     * Send the history of last messages to a specific connection
     * @param connection
     */
    public sendHistory(connection: Connection): void {
        // Send message history to the connection that just joined this room
        const messages = [];
        for (let i = Math.max(0, this.messages.length - Room.MESSAGE_HISTORY_VISIBLE_LENGTH); i < this.messages.length; ++ i) {
            messages.push(this.messages[i].sanitized());
        }
        connection.send('messages', messages);
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
    public getPlugin(name: string): Command {
        const plugin = this.commands[name];
        if (! plugin) {
            throw new Error('Plugin not found');
        }
        return plugin;
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
    public async executeConnectionAuthenticated(connection: Connection): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onConnectionAuthenticated(connection);
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
    public async executeOnConnectionClosed(connection: Connection): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onConnectionClosed(connection);
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
     * Find a message from history by its unique id
     */
    public getMessageById(id: number): Message | null {
        const message = this.messages.find(message => message.id === id);
        return message || null;
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
        if (options.connection) {
            options.meta = options.meta || {};
            options.meta.device = options.connection.device;
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
            message.edit('deleted', `<i>deleted</i>`);
            this.send('message-edit', message.sanitized());
        });
    }
}
