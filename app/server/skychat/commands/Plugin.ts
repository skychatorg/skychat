import {Command} from "./Command";
import {Connection} from "../Connection";


/**
 * Abstract class that represents a plugin. A plugin has access to multiple points of the application through the usage
 *  of hooks. Every room has its own instance of plugin
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
     * Executed when a new
     * @param message
     * @param connection
     */
    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        return message;
    }

    /**
     * Executed when a connection joins a room
     * @param connection
     */
    public async onConnectionJoinedRoom(connection: Connection): Promise<void> {

    }

    /**
     * Executed when a connection is closed
     * @param connection
     */
    public async onConnectionClosed(connection: Connection): Promise<void> {

    }
}
