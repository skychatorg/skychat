import {Server} from "./Server";
import {Client} from "./Client";
import * as http from "http";

type SessionData = {
    seed: number
};


/**
 * The base server class for the skychat
 */
export class SkyChatController {

    private readonly server: Server<SessionData>;

    constructor() {
        this.server = new Server({port: 8080});
        this.server.registerEvent('message', this.onMessage.bind(this), 'string');
        this.server.authenticateFunction = this.authenticate.bind(this);
        this.server.getSessionDataFunction = this.getSessionData.bind(this);
    }

    /**
     * Get a new client username from its request handshake
     */
    private async authenticate(request: http.IncomingMessage): Promise<string> {
        return '*Hamster' + Math.random();
    }

    /**
     * Build a session data object
     */
    private async getSessionData(identifier: string): Promise<SessionData> {
        return {
            seed: Math.random()
        };
    }

    /**
     * When a message is received
     * @param payload
     * @param client
     */
    private async onMessage(payload: string, client: Client<SessionData>): Promise<void> {
        console.log('message', client.session.identifier, client.session.data.seed, payload);
        client.send('message', payload);
    }
}
