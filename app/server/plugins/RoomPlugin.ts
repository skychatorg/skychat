import { Connection } from '../skychat/Connection.js';
import { Message } from '../skychat/Message.js';
import { Plugin } from './Plugin.js';
import { Room } from '../skychat/Room.js';

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
     * Get a summary of this plugin state to include in the room list
     */
    public getRoomSummary(): unknown {
        return null;
    }

    /**
     * Executed before broadcasting a message to the room
     * @abstract
     * @param message
     * @param _connection
     */
    // eslint-disable-next-line no-unused-vars
    public async onBeforeMessageBroadcastHook(message: Message, _connection?: Connection): Promise<Message> {
        return message;
    }

    /**
     * Executed before a connection joins a room
     * @abstract
     * @param _connection
     * @param _room
     */
    // eslint-disable-next-line no-unused-vars
    public async onBeforeConnectionJoinedRoom(_connection: Connection, _room: Room): Promise<void> {
        void 0;
    }

    /**
     * Executed when a connection joins a room
     * @abstract
     * @param _connection
     */
    // eslint-disable-next-line no-unused-vars
    public async onConnectionJoinedRoom(_connection: Connection): Promise<void> {
        void 0;
    }

    /**
     * Executed when a connection is closed
     * @abstract
     * @param _connection
     */
    // eslint-disable-next-line no-unused-vars
    public async onConnectionLeftRoom(_connection: Connection): Promise<void> {
        void 0;
    }
}

/**
 * Defines default constructor for a room plugin (required for TypeScript)
 */
export interface RoomPluginConstructor {
    // eslint-disable-next-line no-unused-vars
    new (_room: Room): RoomPlugin;
    commandName: string;
    commandAliases: string[];
    defaultDataStorageValue?: any;
}
