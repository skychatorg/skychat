import {Command} from "./Command";
import {Connection} from "../generic-server/Connection";
import {Session} from "../generic-server/Session";


/**
 * Abstract class that represents a plugin. A plugin has access to multiple points of the application through the usage
 *  of hooks.
 */
export abstract class Plugin extends Command {

    /**
     * Plugins can modify application values on-the-fly. Therefore it is important to know in advance
     */
    public priority: number = 0;

    /**
     * Executed when a new connection is made to the server
     * @param connection
     */
    public async onNewConnectionHook(connection: Connection<Session>): Promise<void> { };

    /**
     * Executed when a new
     * @param message
     * @param connection
     */
    public async onNewMessage(message: string, connection: Connection<Session>): Promise<string> {
        return message;
    }
}
