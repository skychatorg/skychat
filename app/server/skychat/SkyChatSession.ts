import {Session} from "../generic-server/Session";
import {SkyChatUser} from "./SkyChatUser";
import {Client} from "../generic-server/Client";


/**
 * A SkyChatSession represents a connected client
 */
export class SkyChatSession extends Session {

    /**
     * Associated user (if logged session)
     */
    public user: SkyChatUser;

    constructor(identifier: string) {
        super(identifier);

        this.user = new SkyChatUser(0, identifier, '', {});
    }

    /**
     * Load session data
     */
    public async load(): Promise<void> {

    }

    public attachClient(client: Client<Session>): void {
        super.attachClient(client);
        client.send('set-client', this.user.sanitized())
    }

    public setUser(user: SkyChatUser): void {
        this.user = user;
        this.clients.forEach(client => client.send('set-client', this.user.sanitized()));
    }
}
