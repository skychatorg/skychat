import * as WebSocket from "ws";
import * as http from "http";
import {ServerOptions} from "ws";
import {Client} from "./Client";
import {Session} from "./Session";



type EventHandler<SessionObject extends Session, PayloadType> = (payload: PayloadType, client: Client<SessionObject>) => Promise<void>;
type EventsDescription<SessionObject extends Session> = {
    [eventName: string]: {
        payloadType?: string,
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
     * Authenticate function. Returns an unique identifier that will be used to group client in a session object.
     */
    public authenticateFunction?: (request: http.IncomingMessage) => Promise<string>;

    /**
     * Retrieve a session data from its unique identifier as returned by authenticateFunction
     */
    public getSessionFunction?: (identifier: string) => Promise<SessionObject>;

    constructor(serverConfig: ServerOptions) {
        this.serverConfig = serverConfig;
        this.wss = new WebSocket.Server(serverConfig);
        this.wss.on('connection', this.onConnection.bind(this));
    }

    /**
     * Register an event
     */
    public registerEvent<PayloadType>(name: string, handler: EventHandler<SessionObject, PayloadType>, payloadType?: string): void {
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
    private async onConnection(webSocket: WebSocket, request: http.IncomingMessage): Promise<void> {

        if (typeof this.authenticateFunction !== 'function') {
            throw new Error('Authenticate function is not defined');
        }

        let identifier = await this.authenticateFunction(request);
        if (identifier === null) {
            throw new Error('Invalid identifier');
        }

        if (typeof this.getSessionFunction !== 'function') {
            throw new Error('Session builder is not defined');
        }

        // Create a session based on the just-computed identifier
        const session = await this.getSessionFunction(identifier);

        // Load session data
        await session.loadData();

        // Create a new client object & attach it to the session
        const client = new Client(session, webSocket, request);

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
    private async onClientEvent(eventName: keyof EventsDescription<SessionObject>, payload: any, client: Client<SessionObject>): Promise<void> {
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
