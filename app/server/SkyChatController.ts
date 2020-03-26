import {Server} from "./Server";
import * as WebSocket from "ws";
import * as http from "http";
import {Client} from "./Client";

/**
 * The base server class for the skychat
 */
export class SkyChatController {

    /**
     * Underlying server
     */
    private readonly server: Server;

    /**
     * Create a new controller
     */
    constructor() {
        this.server = new Server({port: 8080});
        this.server.registerEvent('message', this.onMessage.bind(this), 'string');
    }

    /**
     * When a message is received
     * @param payload
     * @param client
     */
    private async onMessage(payload: string, client: Client) {
        console.log('message', payload);
        client.send('message', payload);
    }
}
