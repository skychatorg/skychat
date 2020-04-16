import * as WebSocket from "ws";
import * as http from "http";
import {Data} from "ws";
import {EventEmitter} from "events";
import {Room} from "./Room";
import {Session} from "./Session";
import {IBroadcaster} from "./IBroadcaster";
import {UAParser} from "ua-parser-js";


/**
 * A client represents an open connection to the server
 */
export class Connection extends EventEmitter implements IBroadcaster {

    public session!: Session;

    public readonly webSocket: WebSocket;

    public room: Room | null = null;

    /**
     * Handshake request object
     */
    public readonly request: http.IncomingMessage;

    public readonly origin: string;

    public readonly userAgent: string;

    public readonly ip: string;

    constructor(session: Session, webSocket: WebSocket, request: http.IncomingMessage) {
        super();

        this.webSocket = webSocket;
        this.request = request;

        this.origin = typeof request.headers['origin'] === 'string' ? request.headers['origin'] : '';
        this.userAgent = new UAParser(request.headers["user-agent"]).getBrowser().name || '';
        this.ip = typeof request.headers['X-FORWARDED-FOR'] === 'string' ? request.headers['X-FORWARDED-FOR'] : (request.connection.remoteAddress || '');

        session.attachConnection(this);
        this.webSocket.on('message', message => this.onMessage(message));
        this.webSocket.on('close', (code, message) => this.onClose(code, message));
    }

    /**
     * When a message is received on the socket
     * @param data
     */
    private async onMessage(data: Data): Promise<void> {

        try {

            // If data is not of type string, fail with error
            if (typeof data !== 'string') {
                throw new Error('Incorrect message');
            }

            // Decode & unpack message
            const decodedMessage = JSON.parse(data);
            const eventName = decodedMessage.event;
            const payload = decodedMessage.data;

            // Check that the event name is valid and is registered
            if (typeof eventName !== 'string') {
                throw new Error('Event could not be parsed');
            }

            // Call handler
            this.emit(eventName, payload);

        } catch (error) {

            this.sendError(error);
        }
    }

    /**
     * When the connection is closed
     */
    private async onClose(code?: number, reason?: string): Promise<void> {

        this.session.detachConnection(this);
        if (this.room) {
            await this.room.executeOnConnectionClosed(this);
            this.room.detachConnection(this);
        }
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
     * Send an error back to the websocket
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
    public close(): void {
        this.webSocket.close(4403, "You have been kicked");
    }
}
