import * as WebSocket from "ws";
import * as http from "http";
import {ServerOptions} from "ws";
import {Client} from "./Client";



type EventHandler<T> = (payload: T, client: Client) => Promise<void>;
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

    private readonly serverConfig: ServerOptions;

    private readonly wss: WebSocket.Server;

    constructor(serverConfig: ServerOptions) {
        this.serverConfig = serverConfig;
        this.wss = new WebSocket.Server(serverConfig);
        this.wss.on('connection', this.onConnection.bind(this));
    }

    /**
     * Register an event
     */
    public registerEvent<T>(name: string, handler: EventHandler<T>, payloadType?: string): void {
        this.events[name] = {
            handler: handler.bind(handler),
            payloadType: payloadType,
        };
    }

    /**
     * When a new client connects
     * @param webSocket
     * @param request
     */
    private onConnection(webSocket: WebSocket, request: http.IncomingMessage): void {

        const client = new Client(webSocket, request);

        // For every registered event
        Object.keys(this.events).forEach(eventName => {
            // Register it on the client object
            client.on(eventName, payload => this.onClientEvent(eventName, payload, client));
        });
    }

    /**
     * When a new client connects
     * @param eventName
     * @param payload
     * @param client
     */
    private async onClientEvent(eventName: keyof EventsDescription, payload: any, client: Client): Promise<void> {
        try {

            const event = this.events[eventName];

            // Check payload type
            if (typeof payload !== event.payloadType) {
                throw new Error('Incorrect payload type');
            }

            // Call handler
            await event.handler(payload, client);

        } catch (error) {

            client.sendError(error);
        }
    }
}
