import * as WebSocket from "ws";
import * as http from "http";
import {Data, ServerOptions} from "ws";



type EventHandler<T> = (payload: T, webSocket: WebSocket, request: http.IncomingMessage) => Promise<void>;
type EventDescription = {
    payloadType?: string,
    handler: EventHandler<any>
};
type EventsDescription = { [eventName: string]: EventDescription; };



/**
 * Generic server object. Handle typed event communication.
 */
export class Server {

    /**
     * List of accepted events.
     */
    private readonly events: EventsDescription = {};

    /**
     * Server configuration
     */
    private readonly serverConfig: ServerOptions;

    /**
     * WebSocket server underlying object
     */
    private readonly wss: WebSocket.Server;

    /**
     * Create a new server object
     * @param serverConfig
     */
    constructor(serverConfig: ServerOptions) {
        this.serverConfig = serverConfig;
        this.wss = new WebSocket.Server(serverConfig);
        this.wss.on('connection', this.onConnection.bind(this));
    }

    /**
     * Register an event
     */
    public registerEvent<T>(name: string, handler: EventHandler<T>, payloadType?: string): void {
        this.events[name] = {payloadType, handler};
    }

    /**
     * When a new client connects
     * @param webSocket
     * @param request
     */
    private onConnection(webSocket: WebSocket, request: http.IncomingMessage): void {
        webSocket.on('message', message => this.onMessage(message, webSocket, request));
    }

    /**
     *
     * @param data
     * @param webSocket
     * @param request
     */
    private async onMessage(data: Data, webSocket: WebSocket, request: http.IncomingMessage): Promise<void> {

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
            if (typeof this.events[eventName] !== 'object') {
                throw new Error('Unsupported event');
            }

            // Get event metadata object
            const event = this.events[eventName];

            // Check payload type
            const payloadType = event.payloadType;
            if (typeof payloadType !== 'undefined' && typeof payload !== payloadType) {
                throw new Error('Unsupported payload type.');
            }

            // Call handler
            await event.handler(payload, webSocket, request);

        } catch (error) {

            webSocket.send(JSON.stringify({
                event: 'error',
                data: error.message
            }))
        }
    }
}
