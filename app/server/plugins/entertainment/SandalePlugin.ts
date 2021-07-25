import {Connection} from "../../skychat/Connection";
import {GlobalPlugin} from "../GlobalPlugin";
import {User} from "../../skychat/User";
import {Session} from "../../skychat/Session";
import {UserController} from "../../skychat/UserController";
import { RoomManager } from "../../skychat/RoomManager";


/**
 * This plugins allows anyone to `sandalize` someone else.
 * When someone is `sandalized`, his next message is replaced with a... sandale.
 */
export class SandalePlugin extends GlobalPlugin {

    static readonly MAX_COUNT = 6;

    static readonly COST_PER_SANDALE = 100;

    static readonly commandName = 'sandale';

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

    protected storage: {sandales: {[username: string]: number}} = {
        sandales: {}
    };

    constructor(manager: RoomManager) {
        super(manager);
        this.loadStorage();
    }

    /**
     * Get the number of sandales associated to an username
     * @param username
     */
    private getSandaleCount(username: string): number {
        username = username.toLowerCase();
        return this.storage.sandales[username] || 0;
    }

    /**
     * Remove count sandales from the given username
     * @param username
     * @param count
     */
    private removeSandale(username: string, count: number): void {
        username = username.toLowerCase();
        if (typeof this.storage.sandales[username] === 'undefined' || this.storage.sandales[username] <= 0) {
            return;
        }
        this.storage.sandales[username] -= count;
        if (this.storage.sandales[username] <= 0) {
            delete this.storage.sandales[username];
        }
        this.syncStorage();
    }

    /**
     * Add one or multiple sandales to an username
     * @param username
     * @param count
     */
    private addSandale(username: string, count: number): void {
        username = username.toLowerCase();
        if (typeof this.storage.sandales[username] === 'undefined') {
            this.storage.sandales[username] = 0;
        }
        if (this.getSandaleCount(username) > SandalePlugin.MAX_COUNT) {
            throw new Error('Too many sandales on this user already');
        }
        this.storage.sandales[username] += count;
        this.syncStorage();
    }

    /**
     * On /sandale, sandalize without vergogne
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const identifier = param;
        if (! Session.sessionExists(identifier)) {
            throw new Error('User ' + identifier + ' does not exist');
        }
        await UserController.buy(connection.session.user, SandalePlugin.COST_PER_SANDALE * (1 + this.getSandaleCount(identifier)));
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
            return '/message ' + ':sandale:'.repeat(sandales);
        }
        return message;
    }
}
