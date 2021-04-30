import {Connection} from "./Connection";
import {Plugin} from "./Plugin";
import { RoomManager } from "./RoomManager";


/**
 * Plugin command parameters description object
 */
export type PluginCommandRules = {

    /**
     * Minimum number of expected parameters
     */
    minCount?: number;

    /**
     * Maximum number of parameters
     */
    maxCount?: number;

    /**
     * Minimum duration between two consecutive calls
     */
    coolDown?: number;

    /**
     * Maximum number of time this function can be called within a 10 second window
     */
    maxCallsPer10Seconds?: number;

    /**
     * Expected parameters
     */
    params?: {
        name: string,
        pattern: RegExp,
        info?: string
    }[];
};



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
     * Executed when a new messages comes in
     * @abstract
     * @param message
     * @param connection
     */
    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        return message;
    }

    /**
     * When a connection successfully authenticated
     * @abstract
     * @param connection
     */
    public async onConnectionAuthenticated(connection: Connection): Promise<void> {

    }
}
