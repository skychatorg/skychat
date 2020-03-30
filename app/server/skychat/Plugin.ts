import {Command} from "./Command";
import {Connection} from "./Connection";


/**
 * Abstract class that represents a plugin. A plugin has access to multiple points of the application through the usage
 *  of hooks.
 */
export abstract class Plugin extends Command {

    /**
     * Execute new connection hook
     * @param plugins
     * @param connection
     */
    public static async executeNewConnectionHook(plugins: Plugin[], connection: Connection): Promise<void> {
        for (const plugin of plugins) {
            await plugin.onNewConnectionHook(connection);
        }
    }

    /**
     * Execute new connection hook
     * @param plugins
     * @param message
     * @param connection
     */
    public static async executeNewMessageHook(plugins: Plugin[], message: string, connection: Connection): Promise<string> {
        for (const plugin of plugins) {
            message = await plugin.onNewMessageHook(message, connection);
        }
        return message;
    }

    /**
     * Plugins can modify application values on-the-fly. Therefore it is important to know in advance
     */
    public priority: number = 0;

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
