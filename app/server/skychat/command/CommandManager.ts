import {Command} from "./Command";
import {Plugin} from "./Plugin";
import {MessageCommand} from "./commands/MessageCommand";
import {SandalePlugin} from "./commands/SandalePlugin";
import {AvatarPlugin} from "./commands/AvatarPlugin";


/**
 * Utility class that handles the list of commands and plugins
 */
export class CommandManager {

    /**
     * Available commands and plugins
     */
    public static readonly COMMANDS: Array<new () => Command> = [
        MessageCommand,
        SandalePlugin,
        AvatarPlugin
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
            }
        }
        // Sort plugins by priority
        CommandManager.plugins.sort((a, b) => a.priority - b.priority);
    }
}

CommandManager.initialize();
