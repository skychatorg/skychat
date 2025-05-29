import { EventEmitter } from 'events';
import * as http from 'http';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { UAParser } from 'ua-parser-js';
import { Data, WebSocket } from 'ws';
import { IBroadcaster } from './IBroadcaster.js';
import { Logging } from './Logging.js';
import { RateLimiter } from './RateLimiter.js';
import { Room } from './Room.js';
import { Session } from './Session.js';

/**
 * A client represents an open connection to the server
 */
export class Connection extends EventEmitter implements IBroadcaster {
    // TODO: This limit is also used for the AudioRecorderPlugin, so we currently have to keep it high. The audio limit should be different.
    static readonly MAX_RECEIVED_BYTES_PER_10_SEC = 1024 * 400;

    static readonly MAX_EVENTS_PER_SEC = 30;

    static readonly CLOSE_KICKED = 4403;

    static readonly PING_INTERVAL = 30 * 1000;

    static readonly ACCEPTED_EVENTS = ['message'];

    session!: Session;

    readonly webSocket: WebSocket;

    room: Room | null = null;

    private pingInterval: NodeJS.Timeout | null = null;

    /**
     * Handshake request object
     */
    readonly request: http.IncomingMessage;

    readonly origin: string;

    readonly userAgent: string;

    readonly device: string;

    readonly ip: string;

    /**
     * Will close the connection if the client sends too many non-binary messages
     */
    readonly byteRateLimiter = new RateLimiterMemory({
        points: Connection.MAX_RECEIVED_BYTES_PER_10_SEC,
        duration: 10,
    });

    /**
     * Will close the connection if the client sends too many events
     */
    readonly eventRateLimiter = new RateLimiterMemory({
        points: Connection.MAX_EVENTS_PER_SEC,
        duration: 1,
    });

    /**
     * Maps message types to specific handlers
     */
    // eslint-disable-next-line no-unused-vars
    readonly binaryMessageHandlers: { [keyCode: string]: (data: Buffer) => void } = {};

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
        this.webSocket.on('close', (code, reason) => this.onClose(code, reason));
        this.webSocket.on('error', (error) => this.onError(error));

        this.setRoom(null);
        this.startPing();
    }

    private startPing(): void {
        if (this.pingInterval) {
            this.stopPing();
        }

        this.pingInterval = setInterval(() => {
            if (this.webSocket.readyState !== WebSocket.OPEN) {
                this.stopPing();
                return;
            }

            this.send('ping', null);
        }, Connection.PING_INTERVAL);
    }

    private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    get closed(): boolean {
        if (!this.webSocket) {
            return true;
        }
        return this.webSocket.readyState === WebSocket.CLOSED || this.webSocket.readyState === WebSocket.CLOSING;
    }

    /**
     * When a message is received on the socket
     */
    private async onMessage(data: Data): Promise<void> {
        // Max events per second
        try {
            await this.eventRateLimiter.consume('key');
        } catch (error) {
            this.sendError(new Error('Event rate limit exceeded'));
            this.close();
            return;
        }

        // Count bytes received for rate limit. Close connection if exceeded.
        try {
            if (typeof data === 'string' || data instanceof Buffer) {
                await this.byteRateLimiter.consume('key', data.length);
            } else if (data instanceof ArrayBuffer) {
                await this.byteRateLimiter.consume('key', data.byteLength);
            } else if (Array.isArray(data)) {
                const sum = data.reduce((acc, val) => acc + val.length, 0);
                await this.byteRateLimiter.consume('key', sum);
            }
        } catch (error) {
            this.sendError(new Error('Byte rate limit exceeded'));
            this.close();
            return;
        }

        // Handle incoming message
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
                Logging.error(`Event could not be parsed: "${eventName}" from event "${dataAsString}"`);
                throw new Error(`Event could not be parsed: "${eventName}"`);
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
    private async onClose(code: number, reason: Buffer): Promise<void> {
        Logging.info(`Connection closed for session ${this.session.identifier} with code ${code} and reason ${reason.toString()}`);
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
        Logging.error('WebSocket error', this, error);
    }

    /**
     * Set this connection's room
     * @param room
     */
    setRoom(room: Room | null) {
        this.room = room;
        this.send('join-room', room ? room.id : null);
    }

    /**
     * Get current room id
     */
    get roomId(): number | null {
        return this.room ? this.room.id : null;
    }

    /**
     * Send en event to the websocket
     */
    send(event: string, payload: unknown) {
        const data = JSON.stringify({
            event,
            data: payload,
        });
        this.sendRaw(data);
    }

    sendRaw(data: Buffer | string) {
        this.webSocket.send(data);
    }

    /**
     * Send an error to the websocket
     * @param error
     */
    sendError(error: Error): void {
        this.sendRaw(
            JSON.stringify({
                event: 'error',
                data: error.message,
            }),
        );
    }

    /**
     * Close the underlying websocket connection
     */
    close(code?: number, reason?: string): void {
        Logging.info(`Closing connection ${this.session.identifier} with code ${code} and reason ${reason}`);
        this.webSocket.close(code || 4500, reason || '');
        this.webSocket.terminate();
    }
}
