import {Server} from "./Server";
import {Client} from "./Client";
import * as http from "http";
import {SkyChatSession} from "./SkyChatSession";


/**
 * The base server class for the skychat
 */
export class SkyChatController {

    private readonly server: Server<SkyChatSession>;

    constructor() {
        this.server = new Server({port: 8080}, SkyChatSession);
        this.server.authenticateFunction = this.authenticate.bind(this);
        this.server.registerEvent('message', this.onMessage.bind(this), 'string');
        this.server.registerEvent('register', this.onRegister.bind(this), 'object');
    }

    /**
     * Get a new client username from its request handshake
     */
    private async authenticate(request: http.IncomingMessage): Promise<string> {
        return '*Hamster' + Math.random();
    }

    /**
     * Register event
     * @param payload
     * @param client
     */
    private async onRegister(payload: object, client: Client<SkyChatSession>): Promise<void> {
        console.log(payload);
    }

    /**
     * When a message is received
     * @param payload
     * @param client
     */
    private async onMessage(payload: string, client: Client<SkyChatSession>): Promise<void> {
        console.log('message', client.session.identifier, payload);
        client.send('message', payload);
    }
}
