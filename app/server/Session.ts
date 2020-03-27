import {Client} from "./Client";


/**
 * A session represents an authenticated user. It can have multiple client objects.
 */
export abstract class Session {

    /**
     * Unique session identifier
     */
    public readonly identifier: string;

    private readonly clients: Client<Session>[];

    constructor(identifier: string) {
        this.identifier = identifier;
        this.clients = [];
    }

    /**
     * Attach a client to this session
     * @param client
     */
    public attachClient(client: Client<Session>): void {
        this.clients.push(client);
    }

    /**
     * Loads session data.
     */
    public abstract loadData(): Promise<void>;
}

