import { EventEmitter } from 'events';
import * as http from 'http';
import { UAParser } from 'ua-parser-js';
import { Data, WebSocket } from 'ws';
import { IBroadcaster } from './IBroadcaster.js';
import { RateLimiter } from './RateLimiter.js';
import { Room } from './Room.js';
import { Session } from './Session.js';

/**
 * A client represents an open connection to the server
 */
export class Connection extends EventEmitter implements IBroadcaster {
    public static readonly PING_INTERVAL_MS: number = 10 * 1000;

    public static readonly MAXIMUM_MISSED_PING: number = 1;

    public static readonly CLOSE_PING_TIMEOUT: number = 4504;

    public static readonly CLOSE_KICKED: number = 4403;

    static readonly ACCEPTED_EVENTS = ['message'];

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
    // eslint-disable-next-line no-unused-vars
    public readonly binaryMessageHandlers: { [keyCode: string]: (data: Buffer) => void } = {};

    constructor(session: Session, webSocket: WebSocket, request: http.IncomingMessage) {
        super();

        this.webSocket = webSocket;
        this.request = request;

        const ua = new UAParser(request.headers['user-agent']);
        this.origin = typeof request.headers['origin'] === 'string' ? request.headers['origin'] : '';
        this.userAgent = ua.getBrowser().name || '';
        this.device = ua.getDevice().type || '';
        this.ip = RateLimiter.getIP(request);

        session.attachConnection(this);
        this.webSocket.on('message', (message) => this.onMessage(message));
        this.webSocket.on('close', () => this.onClose());
        this.webSocket.on('error', (error) => this.onError(error));

        this.setRoom(null);
    }

    public get closed(): boolean {
        if (!this.webSocket) {
            return true;
        }
        return this.webSocket.readyState === WebSocket.CLOSED || this.webSocket.readyState === WebSocket.CLOSING;
    }

    /**
     * When a message is received on the socket
     */
    private async onMessage(data: Data): Promise<void> {
        try {
            // Only buffers are accepted
            if (!(data instanceof Buffer)) {
                throw new Error('Invalid data type');
            }

            const dataAsString = data.toString();

            // If not JSON, assume binary
            if (!dataAsString.startsWith('{')) {
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

            if (!Connection.ACCEPTED_EVENTS.includes(eventName)) {
                throw new Error('Invalid event');
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
     */
    public send(event: string, payload: unknown) {
        this.webSocket.send(
            JSON.stringify({
                event,
                data: payload,
            }),
        );
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
        this.webSocket.send(
            JSON.stringify({
                event: 'error',
                data: error.message,
            }),
        );
    }

    /**
     * Close the underlying websocket connection
     */
    public close(code?: number, reason?: string): void {
        this.webSocket.close(code || 4500, reason || '');
        this.webSocket.terminate();
    }
}
