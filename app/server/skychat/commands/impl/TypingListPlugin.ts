import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {User} from "../../User";


/**
 * Handle cursor events
 */
export class TypingListPlugin extends Plugin {

    readonly name = 't';

    readonly minRight = -1;

    readonly rules = {
        minCount: 1,
        maxCount: 1,
        params: [{name: "action", pattern: /^(on|off)$/}]
    };

    /**
     * Identifiers that are currently typing and the associated date when they started typing
     */
    private readonly typingList: {[identifier: string]: {startedDate: Date, user: User}} = {};

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (param === 'on') {
            // Register typer
            this.typingList[connection.session.identifier] = {
                startedDate: new Date(),
                user: connection.session.user
            };

        } else {
            // Remove typer
            delete this.typingList[connection.session.identifier];
        }

        connection.room!.send('typing-list', Object.values(this.typingList).map(entry => entry.user.sanitized()));
    }
}
