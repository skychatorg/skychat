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
        t: {
            minCount: 1,
            maxCount: 1,
            params: [{name: "action", pattern: /^(on|off)$/}]
        }
    };

    readonly hidden = true;

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

        this.sync();
    }

    async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        this.sync();
    }

    async onConnectionClosed(connection: Connection): Promise<void> {
        delete this.typingList[connection.session.identifier];
    }

    private sync(): void {
        this.room.send('typing-list', Object.values(this.typingList).map(entry => entry.user.sanitized()));
    }
}
