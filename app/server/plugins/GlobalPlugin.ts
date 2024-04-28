import { Connection } from '../skychat/Connection.js';
import { RoomManager } from '../skychat/RoomManager.js';
import { Plugin } from './Plugin.js';

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
     * @param _connection
     */
    public async onNewMessageHook(message: string, _connection: Connection): Promise<string> {
        return message;
    }

    /**
     * Execute before a connection registers
     * @param payload
     * @param connection
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async onBeforeRegister(payload: unknown, connection: Connection): Promise<void> {
        void 0;
    }

    /**
     * When a connection is created
     * @abstract
     * @param _connection
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async onNewConnection(_connection: Connection): Promise<void> {
        void 0;
    }

    /**
     * When a connection successfully authenticated
     * @abstract
     * @param _connection
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async onConnectionAuthenticated(_connection: Connection): Promise<void> {
        void 0;
    }

    /**
     * When a connection was closed
     * @abstract
     * @param _connection
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async onConnectionClosed(_connection: Connection): Promise<void> {
        void 0;
    }
}

/**
 * Defines default constructor for a global plugin (required for TypeScript)
 */
export interface GlobalPluginConstructor {
    new (manager: RoomManager): GlobalPlugin;
    commandName: string;
    commandAliases: string[];
    defaultDataStorageValue?: any;
}
