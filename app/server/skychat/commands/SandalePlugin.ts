import {Connection} from "../generic-server/Connection";
import {SkyChatSession} from "../SkyChatSession";
import {User} from "../User";
import {Plugin} from "../Plugin";
import {Room} from "../generic-server/Room";


export class SandalePlugin extends Plugin {

    readonly name: string = 'sandale';

    public readonly minRight: number = -1;

    public readonly roomRequired: boolean = true;

    private sandales: {[username: string]: number} = {};

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

    async run(
        alias: string,
        param: string,
        connection: Connection<SkyChatSession>,
        session: SkyChatSession,
        user: User,
        room: Room | null): Promise<void> {

        // Sandalize without vergogne
        this.addSandale(param, 1);
    }

    public async onNewMessageHook(message: string, connection: Connection<SkyChatSession>): Promise<string> {
        const username = connection.session.identifier;
        const sandales = this.getSandaleCount(username);
        if (sandales > 0) {
            this.removeSandale(username, 1);
            return ':sandale:'.repeat(sandales);
        }
        return message;
    }
}
