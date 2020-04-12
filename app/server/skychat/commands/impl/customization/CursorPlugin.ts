import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {User} from "../../../User";
import {Message} from "../../../Message";
import {UserController} from "../../../UserController";


/**
 * Handle cursor events
 */
export class CursorPlugin extends Plugin {

    readonly defaultDataStorageValue = true;

    readonly name = 'cursor';

    readonly aliases = ['c'];

    readonly minRight = -1;

    readonly rules = {
        cursor: {
            minCount: 1,
            maxCount: 1,
            params: [{name: "action", pattern: /^(on|off)$/}]
        },
        c: {
            minCount: 2,
            maxCount: 2,
            maxCallsPer10Seconds: 100,
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
        await UserController.savePluginData(connection.session.user, this.name, cursorEnabled);
        connection.session.syncUserData();
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
            if (! UserController.getPluginData(conn.session.user, this.name)) {
                // Abort
                continue;
            }
            // Do not send cursor events to the owner
            if (conn.session.identifier === connection.session.identifier) {
                continue;
            }
            // Else, unpack cursor position
            const [x, y] = param.split(' ');
            // And send it to this client
            conn.send('cursor', {
                x: parseFloat(x),
                y: parseFloat(y),
                user: connection.session.user.sanitized()
            })
        }
    }
}
