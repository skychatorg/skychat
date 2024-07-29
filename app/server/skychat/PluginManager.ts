import { GlobalPlugin } from '../plugins/GlobalPlugin.js';
import { globalPluginGroup } from '../plugins/GlobalPluginGroup.js';
import { ConnectionAcceptedEvent } from './AuthBridge.js';
import { Connection } from './Connection.js';
import { MessageFormatter } from './MessageFormatter.js';
import { RoomManager } from './RoomManager.js';

export class PluginManager {
    /**
     * Plugins. All aliases of a command/plugin points to the same command instance.
     */
    commands: { [commandName: string]: GlobalPlugin } = {};

    /**
     * Plugins
     */
    plugins: GlobalPlugin[] = [];

    start(roomManager: RoomManager) {
        this.plugins = globalPluginGroup.instantiateGlobalPlugins(roomManager);
        this.commands = globalPluginGroup.extractCommandObjectFromPlugins(this.plugins) as { [commandName: string]: GlobalPlugin };
    }

    getCommand(commandName: string): GlobalPlugin {
        return this.commands[commandName] ?? null;
    }

    /**
     * Called each time a new connection is created (by SkyChatServer)
     */
    async onConnectionCreated(connection: Connection, event: ConnectionAcceptedEvent): Promise<void> {
        connection.on('binary-message', this.onConnectionBinary.bind(this, connection));
        connection.on('message', this.onConnectionMessage.bind(this, connection));

        this.executeNewConnectionHook(connection, event);
        connection.webSocket.on('close', () => {
            this.executeConnectionClosedHook(connection);
        });
    }

    async onConnectionBinary(connection: Connection, { type, data }: { type: number; data: Buffer }): Promise<void> {
        // Try to find a global plugin that wants to handle the binary message
        try {
            for (const plugin of this.plugins) {
                if (await plugin.onBinaryDataReceived(connection, type, data)) {
                    return;
                }
            }

            // Try to find a room plugin that wants to handle the binary message
            if (connection.room) {
                for (const plugin of connection.room.plugins) {
                    if (await plugin.onBinaryDataReceived(connection, type, data)) {
                        return;
                    }
                }
            }
        } catch (error) {
            connection.sendError(error as Error);
        }
    }

    private async onConnectionMessage(connection: Connection, payload: string): Promise<void> {
        try {
            // Handle default command (/message)
            if (!payload.startsWith('/')) {
                payload = '/message ' + payload;
            }

            payload = await this.executeNewMessageHook(payload, connection);

            // Parse command name and message content
            const { param, commandName } = MessageFormatter.parseCommand(payload);

            // If command linked to a global plugin
            if (typeof this.commands[commandName] !== 'undefined') {
                const command = this.commands[commandName];
                await command.execute(commandName, param, connection);
                return;
            }

            // If command linked to a room plugin
            if (!connection.room) {
                throw new Error('Messages event should be sent in rooms');
            }

            // Get command object
            if (typeof connection.room.commands[commandName] === 'undefined') {
                throw new Error(`Command '${commandName}' is not provided in this room`);
            }
            const command = connection.room.commands[commandName];

            // Register last session interaction
            connection.session.lastInteractionDate = new Date();

            // Execute the room plugin
            await command.execute(commandName, param, connection);
        } catch (error) {
            if (error instanceof Error) {
                connection.sendError(error);
            } else {
                connection.sendError(new Error(`Error: ${error}`));
            }
        }
    }

    private async executeNewMessageHook(message: string, connection: Connection): Promise<string> {
        for (const plugin of this.plugins) {
            message = await plugin.onNewMessageHook(message, connection);
        }
        return message;
    }

    private async executeNewConnectionHook(connection: Connection, event: ConnectionAcceptedEvent): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onNewConnection(connection, event);
        }
    }

    private async executeConnectionClosedHook(connection: Connection): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.onConnectionClosed(connection);
        }
    }
}
