import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {User} from "../../User";


export class SandalePlugin extends Plugin {

    readonly name: string = 'sandale';

    public readonly minRight: number = -1;

    public readonly roomRequired: boolean = true;

    private sandales: {[username: string]: number} = {};

    public readonly minParamCount = 1;

    public readonly maxParamCount = 1;

    public readonly params = [
        {
            name: 'username',
            pattern: User.USERNAME_REGEXP,
            info: 'Target username'
        }
    ];

    /**
     * Get the number of sandales associated to an username
     * @param username
     */
    private getSandaleCount(username: string): number {
        username = username.toLowerCase();
        return this.sandales[username] || 0;
    }

    /**
     * Remove count sandales from the given username
     * @param username
     * @param count
     */
    private removeSandale(username: string, count: number): void {
        username = username.toLowerCase();
        if (typeof this.sandales[username] === 'undefined' || this.sandales[username] <= 0) {
            return;
        }
        this.sandales[username] -= count;
        if (this.sandales[username] <= 0) {
            delete this.sandales[username];
        }
    }

    /**
     * Add one or multiple sandales to an username
     * @param username
     * @param count
     */
    private addSandale(username: string, count: number): void {
        username = username.toLowerCase();
        if (typeof this.sandales[username] === 'undefined') {
            this.sandales[username] = 0;
        }
        this.sandales[username] += count;
    }

    /**
     * On /sandale, sandalize without vergogne
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> {
        this.addSandale(param, 1);
    }

    /**
     * Intercept all messages and replace its content by a sandale if the user is sandalized
     * @param message
     * @param connection
     */
    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        const username = connection.session.identifier;
        const sandales = this.getSandaleCount(username);
        if (sandales > 0) {
            this.removeSandale(username, 1);
            return ':sandale:'.repeat(sandales);
        }
        return message;
    }
}
