import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {User} from "../../User";
import {Message} from "../../Message";


/**
 * Handle cursor events
 */
export class CursorPlugin extends Plugin {

    readonly defaultDataStorageValue = true;

    readonly name = 'cursor';

    readonly aliases = ['c'];

    readonly minRight = -1;

    readonly params = {
        cursor: {
            minCount: 1,
            maxCount: 1,
            params: [{name: "action", pattern: /^(on|off)$/}]
        },
        c: {
            minCount: 2,
            maxCount: 2,
            params: [{name: "x", pattern: /^\d+(\.\d+)?$/}, {name: "y", pattern: /^\d+(\.\d+)?$/}]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (alias === 'cursor') {
            await this.handleToggle(param, connection);
        } else {
            await this.handleCursorEvent(param, connection);
        }
    }

    /**
     * On cursor toggle event.
     * @param param
     * @param connection
     */
    async handleToggle(param: string, connection: Connection): Promise<void> {
        const cursorEnabled = param === 'on';
        await User.savePluginData(connection.session.user, this.name, cursorEnabled);
        connection.send('message', new Message('Cursor: ' + param, User.BOT_USER).sanitized());
    }

    /**
     * On cursor event. Forward the cursor position to every connection in the room that has cursors enabled
     * @param param
     * @param connection
     */
    async handleCursorEvent(param: string, connection: Connection): Promise<void> {
        // For every connection in the room
        for (const conn of connection.room!.connections) {
            // If the user has cursors disabled
            if (! User.getPluginData(conn.session.user, this.name)) {
                // Abort
                continue;
            }
            // Else, unpack cursor position
            const [x, y] = param.split(' ');
            // And send it to this client
            conn.send('cursor', {
                x: parseFloat(x),
                y: parseFloat(y),
                user: conn.session.user.sanitized()
            })
        }
    }
}
