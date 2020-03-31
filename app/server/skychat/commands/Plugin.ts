import {Command} from "./Command";
import {Connection} from "../Connection";


/**
 * Abstract class that represents a plugin. A plugin has access to multiple points of the application through the usage
 *  of hooks.
 */
export abstract class Plugin extends Command {

    /**
     * Plugins can modify application values on-the-fly. Therefore it is important to know in advance
     */
    public readonly priority: number = 0;

    /**
     * If the plugin uses storage, it needs to define a default value for its custom entry in user data object.
     */
    public readonly defaultDataStorageValue?: any;

    /**
     * Executed when a new connection is made to the server
     * @param connection
     */
    public async onNewConnectionHook(connection: Connection): Promise<void> { };

    /**
     * Executed when a new
     * @param message
     * @param connection
     */
    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        return message;
    }
}
