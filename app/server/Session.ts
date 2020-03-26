import {Client} from "./Client";


/**
 * A session represents an authenticated user. It can have multiple client objects.
 */
export class Session {

    /**
     * Unique session identifier
     */
    public readonly identifier: string;

    private readonly clients: Client[];

    constructor(identifier: string) {
        this.identifier = identifier;
        this.clients = [];
    }

    /**
     * Attach a client to this session
     * @param client
     */
    public attachClient(client: Client): void {
        this.clients.push(client);
    }
}
