import * as WebSocket from "ws";
import * as http from "http";
import {ServerOptions} from "ws";
import {Connection} from "./Connection";
import {Session} from "./Session";
import * as iof from "io-filter";



type EventHandler<SessionObject extends Session, payloadFilter> = (payload: payloadFilter, client: Connection<SessionObject>) => Promise<void>;
type EventsDescription<SessionObject extends Session> = {
    [eventName: string]: {
        payloadFilter?: iof.MaskFilter,
        handler: EventHandler<SessionObject, any>
    };
};



/**
 * Generic server object. Handle typed event communication.
 */
export class Server<SessionObject extends Session> {

    /**
     * List of accepted events.
     */
    private readonly events: EventsDescription<SessionObject> = {};

    private readonly serverConfig: ServerOptions;

    private readonly wss: WebSocket.Server;

    /**
     * Builds a session object when a new connection is initiated
     */
    public sessionBuilder: (request: http.IncomingMessage) => Promise<SessionObject>;

    constructor(serverConfig: ServerOptions, sessionBuilder: (request: http.IncomingMessage) => Promise<SessionObject>) {
        this.serverConfig = serverConfig;
        this.sessionBuilder = sessionBuilder;
        this.wss = new WebSocket.Server(serverConfig);
        this.wss.on('connection', this.onConnection.bind(this));
    }

    /**
     * Register a new client event
     * @param name
     * @param handler
     * @param payloadType Type of payload. If set to a string, the type of the payload should be equal to this string. Can also be set to a valid mask filter.
     */
    public registerEvent<PayloadType>(name: string, handler: EventHandler<SessionObject, PayloadType>, payloadType?: string | iof.MaskFilter): void {
        const payloadFilter = typeof payloadType === 'string' ? new iof.ValueTypeFilter(payloadType) : payloadType;
        this.events[name] = {
            handler: handler.bind(handler),
            payloadFilter: payloadFilter,
        };
    }

    /**
     * When a new client connects
     * @param webSocket
     * @param request
     */
    private async onConnection(webSocket: WebSocket, request: http.IncomingMessage): Promise<void> {

        // Create a session based on the just-computed identifier
        const session = await this.sessionBuilder(request);

        // Create a new connection object & attach it to the session
        const connection = new Connection(session, webSocket, request);

        // For every registered event
        Object.keys(this.events).forEach(eventName => {
            // Register it on the connection object
            connection.on(eventName, payload => this.onConnectionEvent(eventName, payload, connection));
        });
    }

    /**
     * When a new event is received
     * @param eventName
     * @param payload
     * @param connection
     */
    private async onConnectionEvent(eventName: keyof EventsDescription<SessionObject>, payload: any, connection: Connection<SessionObject>): Promise<void> {
        try {

            const event = this.events[eventName];

            // If payload filter is defined
            if (event.payloadFilter) {
                // Use it as a mask on the payload
                payload = event.payloadFilter.mask(payload);
            }

            // Call handler
            await event.handler(payload, connection);

        } catch (error) {

            connection.sendError(error);
        }
    }
}
