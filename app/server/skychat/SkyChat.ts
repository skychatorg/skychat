import {Server} from "../generic-server/Server";
import {Client} from "../generic-server/Client";
import * as http from "http";
import {SkyChatSession} from "./SkyChatSession";
import {DatabaseHelper} from "./DatabaseHelper";
import {SkyChatUser} from "./SkyChatUser";
import * as iof from "io-filter";


/**
 * The base server class for the skychat
 */
export class SkyChat {

    private server: Server<SkyChatSession>;

    constructor() {
        this.server = new Server({port: 8080}, SkyChatSession);
        DatabaseHelper
            .load()
            .then(() => {
                this.server.authenticateFunction = this.authenticate.bind(this);

                // On message sent
                this.server.registerEvent('message', this.onMessage.bind(this), 'string');

                // On register
                this.server.registerEvent('register', this.onRegister.bind(this), new iof.ObjectFilter({
                    username: new iof.RegExpFilter(/^[a-zA-Z0-9]$/),
                    password: new iof.RegExpFilter(/^.{4,512}$/),
                }));
            });
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
    private async onRegister(payload: any, client: Client<SkyChatSession>): Promise<void> {
        const username = payload.username;
        const password = payload.password;
        const user = await SkyChatUser.registerUser(username, password);
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
