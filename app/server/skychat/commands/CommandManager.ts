import {Command} from "./Command";
import {Plugin} from "./Plugin";
import {MessageCommand} from "./impl/MessageCommand";
import {SandalePlugin} from "./impl/SandalePlugin";
import {AvatarPlugin} from "./impl/AvatarPlugin";
import {CursorPlugin} from "./impl/CursorPlugin";
import {MutePlugin} from "./impl/MutePlugin";
import {User} from "../User";
import {TypingListPlugin} from "./impl/TypingListPlugin";
import {MotoPlugin} from "./impl/MotoPlugin";
import {YoutubePlugin} from "./impl/YoutubePlugin";
import {Room} from "../Room";


/**
 * Utility class that handles the list of commands and plugins
 */
export class CommandManager {

    /**
     * Available commands and plugins
     */
    public static readonly COMMANDS: Array<new (room: Room) => Command> = [
        AvatarPlugin,
        CursorPlugin,
        MessageCommand,
        MotoPlugin,
        MutePlugin,
        SandalePlugin,
        TypingListPlugin,
        YoutubePlugin
    ];

    /**
     * Load all commands and plugins
     */
    public static instantiateCommands(room: Room) {
        // Initialize command and plugin instances
        const commands: {[commandName: string]: Command} = {};
        // For every command/plugin
        for (let CommandConstructor of CommandManager.COMMANDS) {
            // Instantiate it
            const command = new CommandConstructor(room);
            // Add it in the command object with its name and all its aliases
            commands[command.name] = command;
            command.aliases.forEach((alias: any) => {
                commands[alias] = command;
            });
        }
        return commands;
    }

    /**
     * Load all commands and plugins
     */
    public static extractPlugins(commands: {[commandName: string]: Command}) {
        return Object.keys(commands)
            .filter(commandAlias => commands[commandAlias] instanceof Plugin)
            .filter(pluginAlias => commands[pluginAlias].name === pluginAlias)
            .map(pluginAlias => commands[pluginAlias] as Plugin)
            .sort((a, b) => a.priority - b.priority);
    }

    /**
     * Load the available commands & plugins
     * @TODO remove
     */
    public static initialize() {
        const plugins = CommandManager.extractPlugins(CommandManager.instantiateCommands(null as any));
        plugins.forEach(plugin => {
            if (typeof plugin.defaultDataStorageValue !== 'undefined') {
                User.DEFAULT_DATA_OBJECT.plugins[plugin.name] = plugin.defaultDataStorageValue;
            }
        });
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
}

CommandManager.initialize();
