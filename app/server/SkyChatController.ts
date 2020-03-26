import {Server} from "./Server";
import {Client} from "./Client";
import * as http from "http";

/**
 * The base server class for the skychat
 */
export class SkyChatController {

    private readonly server: Server;

    constructor() {
        this.server = new Server({port: 8080});
        this.server.registerEvent('message', this.onMessage.bind(this), 'string');
        this.server.authenticateFunction = this.authenticate.bind(this);
    }

    /**
     * Get a new client username from its request handshake
     */
    private async authenticate(request: http.IncomingMessage) {
        return '*Hamster' + Math.random();
    }

    /**
     * When a message is received
     * @param payload
     * @param client
     */
    private async onMessage(payload: string, client: Client) {
        console.log('message', client.session.identifier, payload);
        client.send('message', payload);
    }
}
