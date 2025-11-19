import express from 'express';
import { ConnectionAcceptedEvent } from '../skychat/AuthBridge.js';
import { Connection } from '../skychat/Connection.js';
import { RoomManager } from '../skychat/RoomManager.js';
import { Plugin } from './Plugin.js';

export type PluginRoute = {
    method: 'get' | 'post' | 'put' | 'delete';
    path: string;
    handler: (req: express.Request, res: express.Response) => Promise<void>;
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
     */
    // eslint-disable-next-line no-unused-vars
    public async onNewMessageHook(message: string, _connection: Connection): Promise<string> {
        return message;
    }

    /**
     * When a connection is created
     * @abstract
     */
    // eslint-disable-next-line no-unused-vars
    public async onNewConnection(_connection: Connection, _event: ConnectionAcceptedEvent): Promise<void> {
        void 0;
    }

    /**
     * When a connection was closed
     * @abstract
     */
    // eslint-disable-next-line no-unused-vars
    public async onConnectionClosed(_connection: Connection): Promise<void> {
        void 0;
    }

    /**
     * Get HTTP routes for this plugin
     * Routes will be registered under /api/plugin/{commandName}/{path}
     */
    public getRoutes(): PluginRoute[] {
        return [];
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
