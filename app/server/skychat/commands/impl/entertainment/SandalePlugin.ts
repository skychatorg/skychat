import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {User} from "../../../User";
import {Session} from "../../../Session";
import {UserController} from "../../../UserController";


export class SandalePlugin extends Plugin {

    readonly name = 'sandale';

    readonly minRight = 0;

    readonly rules = {
        sandale: {
            minCount: 1,
            maxCount: 1,
            coolDown: 1000,
            params: [
                {
                    name: 'username',
                    pattern: User.USERNAME_REGEXP,
                    info: 'Target username'
                }
            ]
        }
    };

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

    /**
     * On /sandale, sandalize without vergogne
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const identifier = Session.autocompleteIdentifier(param);
        if (! Session.sessionExists(identifier)) {
            throw new Error('User ' + identifier + ' does not exist');
        }
        await UserController.buy(connection.session.user, (1 + this.getSandaleCount(identifier)) * 100);
        this.addSandale(identifier, 1);
    }

    /**
     * Intercept all messages and replace its content by a sandale if the user is sandalized
     * @param message
     * @param connection
     */
    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        if (message.indexOf('/message') !== 0) {
            return message;
        }
        const username = connection.session.identifier;
        const sandales = this.getSandaleCount(username);
        if (sandales > 0) {
            this.removeSandale(username, 1);
            return '/message :sandale:'.repeat(sandales);
        }
        return message;
    }
}
