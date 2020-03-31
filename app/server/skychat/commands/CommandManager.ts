import {Command} from "./Command";
import {Plugin} from "./Plugin";
import {MessageCommand} from "./impl/MessageCommand";
import {SandalePlugin} from "./impl/SandalePlugin";
import {AvatarPlugin} from "./impl/AvatarPlugin";
import {CursorPlugin} from "./impl/CursorPlugin";
import {MutePlugin} from "./impl/MutePlugin";
import {Connection} from "../Connection";
import {User} from "../User";
import {TypingListPlugin} from "./impl/TypingListPlugin";
import {MotoPlugin} from "./impl/MotoPlugin";


/**
 * Utility class that handles the list of commands and plugins
 */
export class CommandManager {

    /**
     * Available commands and plugins
     */
    public static readonly COMMANDS: Array<new () => Command> = [
        AvatarPlugin,
        CursorPlugin,
        MessageCommand,
        MotoPlugin,
        MutePlugin,
        SandalePlugin,
        TypingListPlugin,
    ];

    /**
     * Command instances (including plugins).
     * All aliases of a command/plugin points to the same command instance.
     */
    public static commands: {[commandName: string]: Command};

    /**
     * List of loaded plugins
     */
    public static plugins: Plugin[];

    /**
     * Load the available commands & plugins
     */
    public static initialize() {
        // Initialize command and plugin instances
        CommandManager.commands = {};
        CommandManager.plugins = [];
        // For every command/plugin
        for (let CommandConstructor of CommandManager.COMMANDS) {
            // Instantiate it
            const command = new CommandConstructor();
            // Add it in the command object with its name and all its aliases
            CommandManager.commands[command.name] = command;
            command.aliases.forEach((alias: any) => {
                CommandManager.commands[alias] = command;
            });
            // If it's a plugin, register it
            if (command instanceof Plugin) {
                CommandManager.plugins.push(command);
                // If plugin uses data storage and has a default value
                if (typeof command.defaultDataStorageValue !== 'undefined') {
                    User.DEFAULT_DATA_OBJECT.plugins[command.name] = command.defaultDataStorageValue;
                }
            }
        }
        // Sort plugins by priority
        CommandManager.plugins.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Execute new connection hook
     * @param connection
     */
    public static async executeNewConnectionHook(connection: Connection): Promise<void> {
        for (const plugin of CommandManager.plugins) {
            await plugin.onNewConnectionHook(connection);
        }
    }

    /**
     * Execute new connection hook
     * @param message
     * @param connection
     */
    public static async executeNewMessageHook(message: string, connection: Connection): Promise<string> {
        for (const plugin of CommandManager.plugins) {
            message = await plugin.onNewMessageHook(message, connection);
        }
        return message;
    }

    /**
     * Get command name from the message
     * @param message
     */
    public static parseMessage(message: string): {param: string, commandName: string} {
        message = message.trim();
        if (message[0] !== '/') {
            message = '/message ' + message;
        }
        const commandName = message.split(' ')[0].substr(1).toLowerCase();
        const param = message.substr(commandName.length + 2);
        return {param, commandName};
    }

    /**
     * Get command name from the message
     * @param commandName
     */
    public static getCommand(commandName: string): Command | undefined {
        return this.commands[commandName];
    }
}

CommandManager.initialize();
