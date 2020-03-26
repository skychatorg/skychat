import {Client} from "./Client";


/**
 * A session represents an authenticated user. It can have multiple client objects.
 */
export class Session<SessionData> {

    /**
     * Unique session identifier
     */
    public readonly identifier: string;

    private readonly clients: Client<SessionData>[];

    public readonly data: SessionData;

    constructor(identifier: string, data: SessionData) {
        this.identifier = identifier;
        this.data = data;
        this.clients = [];
    }

    /**
     * Attach a client to this session
     * @param client
     */
    public attachClient(client: Client<SessionData>): void {
        this.clients.push(client);
    }
}
