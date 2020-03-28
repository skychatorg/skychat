import {Session} from "../generic-server/Session";
import {SkyChatUser} from "./SkyChatUser";
import {Connection} from "../generic-server/Connection";


/**
 * A SkyChatSession represents a connected user, who has an account or not
 */
export class SkyChatSession extends Session {

    /**
     * Associated user (if logged session)
     */
    public user: SkyChatUser;


    constructor(identifier: string) {
        super(identifier);

        this.user = new SkyChatUser(0, identifier, '', 0, {});
    }

    /**
     * Attach a connection to this session
     * @param connection
     */
    public attachConnection(connection: Connection<Session>): void {
        super.attachConnection(connection);

        connection.send('set-user', this.user.sanitized())
    }

    /**
     * Set associated user
     * @param user
     */
    public setUser(user: SkyChatUser): void {
        this.identifier = user.username.toLowerCase();
        this.user = user;
        this.connections.forEach(connection => connection.send('set-user', this.user.sanitized()));
    }
}
