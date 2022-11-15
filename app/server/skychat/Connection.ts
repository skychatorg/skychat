
import * as WebSocket from 'ws';
import * as http from 'http';
import { UAParser } from 'ua-parser-js';
import { Data } from 'ws';
import { EventEmitter } from 'events';
import { Room } from './Room';
import { Session } from './Session';
import { IBroadcaster } from './IBroadcaster';



/**
 * A client represents an open connection to the server
 */
export class Connection extends EventEmitter implements IBroadcaster {
    public static readonly PING_INTERVAL_MS: number = 10 * 1000;

    public static readonly MAXIMUM_MISSED_PING: number = 1;

    public static readonly CLOSE_PING_TIMEOUT: number = 4504;

    public static readonly CLOSE_KICKED: number = 4403;

    public session!: Session;

    public readonly webSocket: WebSocket;

    public room: Room | null = null;

    /**
     * Handshake request object
     */
    public readonly request: http.IncomingMessage;

    public readonly origin: string;

    public readonly userAgent: string;

    public readonly device: string;

    public readonly ip: string;

    /**
     * Maps message types to specific handlers
     */
    public readonly binaryMessageHandlers: { [keyCode: string]: (data: Buffer) => void } = {};

    private lastPingDate: Date;

    constructor(session: Session, webSocket: WebSocket, request: http.IncomingMessage) {
        super();

        this.webSocket = webSocket;
        this.request = request;

        const ua = new UAParser(request.headers['user-agent']);
        this.origin = typeof request.headers['origin'] === 'string' ? request.headers['origin'] : '';
        this.userAgent = ua.getBrowser().name || '';
        this.device = ua.getDevice().type || '';
        this.ip = typeof request.headers['x-forwarded-for'] === 'string' ? request.headers['x-forwarded-for'] : (request.connection.remoteAddress || '');
        this.lastPingDate = new Date();

        session.attachConnection(this);
        this.webSocket.on('message', (message) => this.onMessage(message));
        this.webSocket.on('close', () => this.onClose());
        this.webSocket.on('error', (error) => this.onError(error));

        setTimeout(this.sendPing.bind(this), Connection.PING_INTERVAL_MS);
        this.on('pong', this.onPong.bind(this));
        this.on('ping', this.onPing.bind(this));

        this.setRoom(null);
    }

    /**
     * Send a ping to the client
     */
    private async sendPing(): Promise<void> {
        return;

        // If websocket is not open, ignore
        if (this.webSocket.readyState !== WebSocket.OPEN) {
            return;
        }

        // If last pings did not came back
        const missedPings = (new Date().getTime() - this.lastPingDate.getTime()) / Connection.PING_INTERVAL_MS - 1;
        if (missedPings > Connection.MAXIMUM_MISSED_PING) {
            this.webSocket.close(Connection.CLOSE_PING_TIMEOUT);
            return;
        }

        this.send('ping', null);
        setTimeout(this.sendPing.bind(this), Connection.PING_INTERVAL_MS);
    }

    /**
     * When the pong comes back
     */
    private async onPong(): Promise<void> {
        this.lastPingDate = new Date();
    }

    /**
     * Send a pong to the client
     */
    private async onPing(): Promise<void> {
        this.send('pong', null);
    }

    public get closed(): boolean {
        if (! this.webSocket) {
            return true;
        }
        return this.webSocket.readyState === WebSocket.CLOSED || this.webSocket.readyState === WebSocket.CLOSING;
    }

    /**
     * When a message is received on the socket
     * @param data
     */
    private async onMessage(data: Data): Promise<void> {
        try {
            // Data is always buffer
            if (! (data instanceof Buffer)) {
                throw new Error('Invalid data type');
            }

            /**
             * TODO:
             *  Always converting to string is not the cleanest solution we can find
             *      to discriminate between binary and non-binary messages, but it eases debugging messages
             *      from Chrome devtools as we can see the content of json messages.
            */

            const dataAsString = data.toString();

            // If data is not of type string, fail with error
            if (! dataAsString.startsWith('{')) {
                const messageType = data.readUInt16LE(0);
                const messageData = data.slice(2);
                this.emit('binary-message', { type: messageType, data: messageData });
                return;
            }

            // Decode & unpack message
            const decodedMessage = JSON.parse(dataAsString);
            const eventName = decodedMessage.event;
            const payload = decodedMessage.data;

            // Check that the event name is valid and is registered
            if (typeof eventName !== 'string') {
                throw new Error('Event could not be parsed');
            }

            // Call handler
            this.emit(eventName, payload);
        } catch (error) {
            this.sendError(error as Error);
        }
    }

    /**
     * When the connection is closed
     */
    private async onClose(): Promise<void> {
        this.session.detachConnection(this);
        if (this.room) {
            this.room.detachConnection(this);
        }
    }

    /**
     * Error on the websocket
     * @param error
     */
    private async onError(error: Error): Promise<void> {
        console.error('WebSocket error', this, error);
    }

    /**
     * Set this connection's room
     * @param room
     */
    public setRoom(room: Room | null) {
        this.room = room;
        this.send('join-room', room ? room.id : null);
    }

    /**
     * Get current room id
     */
    public get roomId(): number | null {
        return this.room ? this.room.id : null;
    }

    /**
     * Send en event to the websocket
     * @param event
     * @param payload
     */
    public send(event: string, payload: any) {
        this.webSocket.send(JSON.stringify({
            event,
            data: payload
        }));
    }

    /**
     * Send an info message to the websocket
     * @param message
     */
    public sendInfo(message: string): void {
        this.webSocket.send(JSON.stringify({ event: 'info', data: message }));
    }

    /**
     * Send an error to the websocket
     * @param error
     */
    public sendError(error: Error): void {
        this.webSocket.send(JSON.stringify({
            event: 'error',
            data: error.message
        }));
    }

    /**
     * Close the underlying websocket connection
     */
    public close(code?: number, reason?: string): void {
        this.webSocket.close(code || 4500, reason || '');
        this.webSocket.terminate();
    }
}
