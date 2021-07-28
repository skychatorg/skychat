import {Connection} from "../../skychat/Connection";
import {GlobalPlugin} from "../GlobalPlugin";
import {User} from "../../skychat/User";
import {Session} from "../../skychat/Session";


/**
 * Handle cursor events
 */
export class MutePlugin extends GlobalPlugin {

    static readonly commandName = 'mute';

    static readonly commandAliases = ['unmute'];

    readonly minRight = 40;

    readonly rules = {
        mute: {
            minCount: 2,
            maxCount: 2,
            params: [{name: "username", pattern: User.USERNAME_REGEXP}, {name: "duration", pattern: /^\d+$/}]
        },
        unmute: {
            minCount: 1,
            maxCount: 1,
            params: [{name: "username", pattern: User.USERNAME_REGEXP}]
        },
    };

    /**
     * List of muted identifiers
     */
    private muted: {[identifier: string]: Date} = {};

    /**
     * Handle muted clients when they try to post a message
     * @param message
     * @param connection
     */
    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        const identifier = connection.session.identifier;
        // If there is an entry for this session
        if (typeof this.muted[identifier] !== 'undefined') {
            // If still muted
            if (new Date() < this.muted[identifier]) {
                // Fail with error
                throw new Error('You are muted until ' + this.muted[identifier]);
            } else {
                // Else, clean up entry
                delete this.muted[identifier];
            }
        }
        return message;
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        switch (alias) {

            case 'mute':
                await this.handleMute(param, connection);
                break;

            case 'unmute':
                await this.handleUnmute(param, connection);
                break;
        }
    }

    /**
     * Mute someone
     * @param param
     * @param connection
     */
    async handleMute(param: string, connection: Connection): Promise<void> {
        const identifier = param.split(' ')[0].toLowerCase();
        const duration = parseInt(param.split(' ')[1]);
        if (! Session.sessionExists(identifier)) {
            throw new Error('User ' + identifier + ' does not exist');
        }
        this.muted[identifier] = new Date(Date.now() + duration * 1000);
    }

    /**
     * Unmute someone
     * @param param
     * @param connection
     */
    async handleUnmute(param: string, connection: Connection): Promise<void> {
        const identifier = param.split(' ')[0].toLowerCase();
        if (! Session.sessionExists(identifier)) {
            throw new Error('User ' + identifier + ' does not exist');
        }
        delete this.muted[identifier];
    }
}
