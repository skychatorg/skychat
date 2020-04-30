import {Command} from "./Command";
import {Connection} from "../Connection";
import {Message} from "../Message";
import * as fs from "fs";
import {Room} from "../Room";



/**
 * Abstract class that represents a plugin. A plugin has access to multiple points of the application through the usage
 *  of hooks. Every room has its own instance of plugin. A plugin can also save data to persistent storage.
 */
export abstract class Plugin extends Command {

    /**
     * Base path for plugin persistent storage
     */
    public static readonly STORAGE_BASE_PATH: string = 'storage/plugins';

    /**
     * Plugins can modify application values on-the-fly. Therefore it is important to know in advance
     */
    public readonly priority: number = 0;

    /**
     * If the plugin uses storage, it needs to define a default value for its custom entry in user data object.
     */
    public readonly defaultDataStorageValue?: any;

    /**
     * This plugin's persistent storage
     */
    protected storage: any = null;

    /**
     * Save this plugin's data to the disk
     */
    protected syncStorage(): void {
        if (! this.storage) {
            return;
        }
        fs.writeFileSync(this.getStoragePath(), JSON.stringify(this.storage));
    }

    /**
     * Save this plugin's data to the disk
     */
    protected loadStorage(): void {
        try {
            this.storage = JSON.parse(fs.readFileSync(this.getStoragePath()).toString());
        } catch (e) {
            this.syncStorage();
        }
    }

    /**
     * Get this plugin's storage path
     */
    public getStoragePath(): string {
        return `${Plugin.STORAGE_BASE_PATH}/${this.name}.json`;
    }

    /**
     * Executed when a new
     * @param message
     * @param connection
     */
    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        return message;
    }

    /**
     * When a connection successfully authenticated
     * @param connection
     */
    public async onConnectionAuthenticated(connection: Connection): Promise<void> {

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

    /**
     * Executed before broadcasting a message to the room
     * @param message
     * @param connection
     */
    public async onBeforeMessageBroadcastHook(message: Message, connection?: Connection): Promise<Message> {
        return message;
    }
}
