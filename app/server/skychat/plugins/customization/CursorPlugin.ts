import {Connection} from "../../Connection";
import {Plugin} from "../../Plugin";
import {User} from "../../User";
import {Message} from "../../Message";
import {UserController} from "../../UserController";
import { Room } from "../../Room";
import { Session } from "../../Session";


/**
 * Handle cursor events
 * @TODO handle cursors mapping periodical cleanup
 */
export class CursorPlugin extends Plugin {

    static readonly CURSOR_DECAY_DELAY = 5 * 1000;

    readonly defaultDataStorageValue = true;

    readonly name = 'cursor';

    readonly aliases = ['c'];

    readonly minRight = -1;

    readonly hidden = true;

    public readonly cursors: {[identifier: string]: {x: number, y: number, lastSent: Date}} = {};

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

    constructor(room: Room) {
        super(room);

        if (this.room) {
            setInterval(this.cleanUpCursors.bind(this), CursorPlugin.CURSOR_DECAY_DELAY);
        }
    }

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
        // Else, unpack cursor position
        const [xRaw, yRaw] = param.split(' ');
        const [x, y] = [parseFloat(xRaw), parseFloat(yRaw)];
        // Store entry
        this.cursors[connection.session.identifier] = {
            x, y,
            lastSent: new Date()
        };
        // For every connection
        for (const session of Object.values(Session.sessions)) {
            for (const conn of session.connections) {
                // If the user has cursors disabled
                if (! UserController.getPluginData(conn.session.user, this.name)) {
                    // Abort
                    continue;
                }
                // Do not send cursor events to the owner
                if (conn.session.identifier === connection.session.identifier) {
                    continue;
                }
                // And send it to this client
                conn.send('cursor', {
                    x, y, 
                    user: connection.session.user.sanitized()
                });
            }
        }
    }

    /**
     * Send a cursor position to all users
     * @param user 
     * @param x 
     * @param y 
     */
    async sendCursorPosition(user: User, x: number, y: number): Promise<void> {

        // For every connection in the room
        for (const conn of this.room.connections) {
            // If the user has cursors disabled, don't send
            if (! UserController.getPluginData(conn.session.user, this.name)) {
                continue;
            }
            conn.send('cursor', { x, y, user });
        }
    }

    /**
     * Remove obsolete cursor entries from cache
     */
    cleanUpCursors(): void {
        // For each saved cursor position
        for (const identifier of Object.keys(this.cursors)) {
            // If it did not move since >5s
            if (new Date().getTime() - this.cursors[identifier].lastSent.getTime() > CursorPlugin.CURSOR_DECAY_DELAY) {
                // Remove entry
                delete this.cursors[identifier];
            }
        }
    }
}
