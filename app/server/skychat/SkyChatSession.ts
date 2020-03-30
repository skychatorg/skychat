import {Session} from "../generic-server/Session";
import {User} from "./User";
import {Connection} from "../generic-server/Connection";


/**
 * A SkyChatSession represents a connected user, who has an account or not
 */
export class SkyChatSession extends Session {

    /**
     * Associated user (if logged session)
     */
    public user: User;


    constructor(identifier: string) {
        super(identifier);

        this.user = new User(0, identifier, '', -1, {});
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
    public setUser(user: User): void {
        this.identifier = user.username.toLowerCase();
        this.user = user;
        this.connections.forEach(connection => connection.send('set-user', this.user.sanitized()));
    }
}
