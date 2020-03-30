import {Connection} from "./Connection";
import {Room} from "./Room";


/**
 * A session represents an user. It can have multiple connections.
 */
export abstract class Session {

    /**
     * Object mapping all active sessions
     */
    private static sessions: {[identifier: string]: Session} = {};

    /**
     * Unique session identifier
     */
    private _identifier!: string;

    public connections: Connection<Session>[];

    /**
     * Find an existing session using its identifier
     * @param identifier
     */
    public static getSessionByIdentifier(identifier: string): Session | undefined {
        return Session.sessions[identifier];
    }

    constructor(identifier: string) {
        this.connections = [];
        this.identifier = identifier;
    }

    /**
     * Detach a connection from this session
     * @param connection
     */
    public detachConnection(connection: Connection<Session>): void {
        this.connections = this.connections.filter(c => c !== connection);
    }

    /**
     * Attach a connection to this session
     * @param connection
     */
    public attachConnection(connection: Connection<Session>): void {
        if (connection.session === this) {
            return;
        }
        if (connection.session) {
            connection.session.detachConnection(connection);
        }
        connection.session = this;
        this.connections.push(connection);
    }

    /**
     * Update a session unique identifier
     * @param identifier
     */
    public set identifier(identifier: string) {
        if (Session.getSessionByIdentifier(identifier)) {
            throw new Error('Cannot change identifier to ' + identifier + ': Identifier must be unique');
        }
        if (this._identifier) {
            delete Session.sessions[this._identifier];
        }
        this._identifier = identifier;
        Session.sessions[identifier] = this;
    }

    public get identifier(): string {
        return this._identifier;
    }

    /**
     * Send to all this session's connections
     * @param event
     * @param payload
     */
    public send(event: string, payload: any): void {
        this.connections.forEach(connection => connection.send(event, payload));
    }
}

