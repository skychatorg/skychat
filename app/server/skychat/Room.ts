import {Connection} from "./Connection";
import {Session} from "./Session";
import {User} from "./User";
import {IBroadcaster} from "./IBroadcaster";
import {Message} from "./Message";


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
    public attachConnection(connection: Connection) {
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
     * Send a new message to the room
     */
    public sendMessage(messageContent: string, user: User): void {
        // Create new message object
        const message = new Message(messageContent, user);
        // Send it to clients
        this.send('message', message.sanitized());
        // Add it to history
        this.messages.push(message);
        this.messages.splice(0, this.messages.length - Room.MESSAGE_HISTORY_LENGTH);
    }
}
