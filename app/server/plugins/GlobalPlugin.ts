import { Connection } from "../skychat/Connection";
import { Plugin } from "./Plugin";
import { RoomManager } from "../skychat/RoomManager";


/**
 * These types exist and are defined in each plugin instance, but TypeScript has to know it to access them
 */
export interface GlobalPluginConstructor {
    new (manager: RoomManager): GlobalPlugin;
    commandName: string;
    commandAliases: string[]
    defaultDataStorageValue?: any;
}


/**
 * A global plugin is a plugin which instantied once at the level of the room manager
 */
export abstract class GlobalPlugin extends Plugin {
    
    public static readonly isGlobal: boolean = true;

    /**
     * Reference to the room manager
     */
    public readonly manager: RoomManager;

    /**
     * A globally instantiated plugin
     * @param manager 
     */
    constructor(manager: RoomManager) {
        super();
        this.manager = manager;
    }

    /**
     * Storage path for global plugins
     */
    public getStoragePath(): string {
        return `${Plugin.STORAGE_BASE_PATH}/plugins/global`;
    }

    /**
     * Executed when a new messages comes in
     * @abstract
     * @param message
     * @param connection
     */
    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        return message;
    }

    /**
     * When a connection is created
     * @abstract
     * @param connection
     */
    public async onNewConnection(connection: Connection): Promise<void> {

    }

    /**
     * When a connection successfully authenticated
     * @abstract
     * @param connection
     */
    public async onConnectionAuthenticated(connection: Connection): Promise<void> {

    }

    /**
     * When a connection was closed
     * @abstract
     * @param connection
     */
    public async onConnectionClosed(connection: Connection): Promise<void> {

    }
}
