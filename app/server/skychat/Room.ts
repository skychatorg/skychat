import {Connection} from "./Connection";
import {IBroadcaster} from "./IBroadcaster";
import {Message} from "./Message";
import {Command} from "./commands/Command";
import {Plugin} from "./commands/Plugin";
import {CommandManager} from "./commands/CommandManager";


export class Room implements IBroadcaster {

    /**
     * Number of messages kept in memory
     */
    static readonly MESSAGE_HISTORY_LENGTH = 256;

    /**
     * Number of messages sent to clients that join the room. Must be lower than message history length.
     */
    static readonly MESSAGE_HISTORY_VISIBLE_LENGTH = 128;

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

    constructor() {
        this.commands = CommandManager.instantiateCommands(this);
        this.plugins = CommandManager.extractPlugins(this.commands);
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
        connection.room = this;
        this.connections.push(connection);
        // Send message history to the connection that just joined this room
        for (let i = Math.max(0, this.messages.length - Room.MESSAGE_HISTORY_VISIBLE_LENGTH); i < this.messages.length; ++ i) {
            connection.send('message', this.messages[i].sanitized());
        }
        await this.executeConnectionJoinedRoom(connection);
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
    public sendMessage(message: Message): void {
        // Send it to clients
        this.send('message', message.sanitized());
        // Add it to history
        this.messages.push(message);
        this.messages.splice(0, this.messages.length - Room.MESSAGE_HISTORY_LENGTH);
    }
}
