import {SanitizedUser, User} from "./User";
import {Connection} from "./Connection";
import {IBroadcaster} from "./IBroadcaster";


export type SanitizedSession = {

    identifier: string;

    connectionCount: number;

    deadSinceTime?: number;

    lastMessageTime: number;

    user: SanitizedUser;
}

/**
 * A SkyChatSession represents a connected user, who has an account or not
 */
export class Session implements IBroadcaster {

    static readonly DEAD_GUEST_SESSION_CLEANUP_DELAY_MS = 30 * 1000;

    static readonly DEAD_USER_SESSION_CLEANUP_DELAY_MS = 25 * 60 * 1000;

    /**
     * Object mapping all active sessions
     */
    static sessions: {[identifier: string]: Session} = {};

    /**
     * Find an existing session using its identifier
     * @param identifier
     */
    public static getSessionByIdentifier(identifier: string): Session | undefined {
        return Session.sessions[identifier];
    }

    /**
     * Autocomplete an identifier to match an active existing identifier
     * @param identifier
     */
    public static autocompleteIdentifier(identifier: string): string {
        const matches = Object.keys(Session.sessions).filter(i => i.indexOf(identifier.toLowerCase()) === 0);
        if (matches.length !== 1) {
            return identifier.toLowerCase();
        }
        return matches[0];
    }

    /**
     * Tells if there is currently an active session for a given identifier
     * @param identifier
     */
    public static sessionExists(identifier: string): boolean {
        return typeof Session.getSessionByIdentifier(identifier) !== 'undefined';
    }

    public static cleanUpSession(identifier: string, immediate?: boolean): boolean {
        const session = Session.getSessionByIdentifier(identifier);
        // If session does not exist
        if (! session) {
            return false;
        }
        // If session still has active connections
        if (! session.deadSince) {
            return false;
        }
        // If session is dead since less than cleanUpDelayMs millis
        const defaultCleanUpDelay = session.getDefaultCleanUpDelay();
        if (! immediate && new Date().getTime() - session.deadSince.getTime() < defaultCleanUpDelay) {
            return false;
        }
        // Clean the session
        delete Session.sessions[identifier];
        return true;
    }

    public static cleanUpAllSessions(immediate?: boolean): void {
        for (const identifier of Object.keys(Session.sessions)) {
            Session.cleanUpSession(identifier, immediate);
        }
    }

    public static cleanUpInterval = setInterval(Session.cleanUpAllSessions, 5 * 1000);

    /**
     * Unique session identifier (lower case)
     */
    private _identifier!: string;

    public connections: Connection[];

    public lastMessageDate: Date;

    /**
     * Date since the last active connection has disconnected. 
     */
    public deadSince: Date | null;

    /**
     * Associated user (if logged session)
     */
    public user: User;


    constructor(identifier: string) {
        this.connections = [];
        this.identifier = identifier;
        this.user = new User(0, identifier, null, '', 0, 0, -1);
        this.lastMessageDate = new Date();
        this.deadSince = null;
    }

    public getDefaultCleanUpDelay(): number {
        return this.user.id === 0 ? Session.DEAD_GUEST_SESSION_CLEANUP_DELAY_MS : Session.DEAD_USER_SESSION_CLEANUP_DELAY_MS;
    }

    /**
     * Detach a connection from this session
     * @param connection
     */
    public detachConnection(connection: Connection): void {
        this.connections = this.connections.filter(c => c !== connection);
        // If the last active connection leaves, mark this object as dead
        if (this.connections.length === 0) {
            this.deadSince = new Date();
        }
    }

    /**
     * Update a session unique identifier
     * @param identifier
     */
    public set identifier(identifier: string) {
        identifier = identifier.toLowerCase();
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
     * Attach a connection to this session
     * @param connection
     */
    public attachConnection(connection: Connection): void {
        if (connection.session === this) {
            return;
        }
        if (connection.session) {
            const oldIdentifier = connection.session.identifier;
            connection.session.detachConnection(connection);
            Session.cleanUpSession(oldIdentifier, true);
        }
        connection.session = this;
        this.connections.push(connection);
        // If this session was marked as dead, mark it as alive
        this.deadSince = null;

        connection.send('set-user', this.user.sanitized())
    }

    /**
     * Set associated user
     * @param user
     */
    public setUser(user: User): void {
        this.identifier = user.username.toLowerCase();
        this.user = user;
        this.syncUserData();
    }

    /**
     * Sync user data with connections
     */
    public syncUserData(): void {
        if (! this.user) {
            return;
        }
        this.connections.forEach(connection => connection.send('set-user', this.user.sanitized()));
    }

    /**
     * Send to all this session's connections
     * @param event
     * @param payload
     */
    public send(event: string, payload: any): void {
        this.connections.forEach(connection => connection.send(event, payload));
    }

    /**
     * Sanitize this object to send it to clients
     */
    public sanitized(): SanitizedSession {
        return {
            identifier: this.identifier,
            connectionCount: this.connections.length,
            deadSinceTime: this.deadSince ? this.deadSince.getTime() * 0.001 : undefined,
            lastMessageTime: this.lastMessageDate.getTime() * 0.001,
            user: this.user.sanitized()
        }
    }
}
