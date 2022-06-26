import { Connection } from "../skychat/Connection";
import { Message } from "../skychat/Message";
import { Plugin } from "./Plugin";
import { Room } from "../skychat/Room";


/**
 * These types exist and are defined in each plugin instance, but TypeScript has to know it to access them
 */
export interface RoomPluginConstructor {
    new (room: Room): RoomPlugin;
    // These types exist and are defined in each plugin instance, but TypeScript has to know it to access them
    commandName: string;
    commandAliases: string[];
    defaultDataStorageValue?: any;
}


export abstract class RoomPlugin extends Plugin {

    /**
     * Some plugins (i.e. plugin to ban users) are globally available.
     * They have a single storage file, and they are instantiated only once at the root-level instead of once per room.
     * This static attribute need to be set
     */
    public static readonly isGlobal: boolean = false;

    /**
     * If the plugin is attached to a room, contain the reference to the room
     */
    public readonly room: Room;

    /**
     * A plugin is attached to a given room
     * @param room 
     */
    constructor(room: Room) {
        super();
        this.room = room;
    }

    /**
     * Get this plugin's storage path
     * @override
     */
    public getStoragePath(): string {
        return `${Plugin.STORAGE_BASE_PATH}/plugins/${this.room.id}`;
    }

    /**
     * Executed before broadcasting a message to the room
     * @abstract
     * @param message
     * @param connection
     */
    public async onBeforeMessageBroadcastHook(message: Message, connection?: Connection): Promise<Message> {
        return message;
    }

    /**
     * Executed before a connection joins a room
     * @abstract
     * @param connection
     */
    public async onBeforeConnectionJoinedRoom(connection: Connection): Promise<void> {

    }

    /**
     * Executed when a connection joins a room
     * @abstract
     * @param connection
     */
    public async onConnectionJoinedRoom(connection: Connection): Promise<void> {

    }

    /**
     * Executed when a connection is closed
     * @abstract
     * @param connection
     */
    public async onConnectionLeftRoom(connection: Connection): Promise<void> {

    }
}
