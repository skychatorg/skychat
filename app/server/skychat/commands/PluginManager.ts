import { Plugin } from "./Plugin";
import { Room } from "../Room";
import { Config } from "../Config";
const impl = require('./impl/');


/**
 * Utility class that handles the list of commands and plugins
 */
export class PluginManager {

    /**
     * Load all commands and plugins
     */
    public static instantiatePlugins(room: Room) {
        // Initialize command and plugin instances
        const commands: {[commandName: string]: Plugin} = {};
        const plugins: Plugin[] = [];
        // For every command/plugin
        for (let commandName of Config.getPlugins()) {
            // Check if the command/plugin exists
            if (typeof impl[commandName] !== 'function') {
                throw new Error(`Unable to load command/plugin ${commandName}. Ensure the corresponding file is there and the plugin class exported.`);
            }
            // Instantiate it
            const PluginConstructor = impl[commandName];
            const plugin = new PluginConstructor(room);
            plugins.push(plugin);
            // Add it in the command object with its name and all its aliases
            if (typeof commands[plugin.name] !== 'undefined') {
                throw new Error(`Plugin command ${plugin.name} is implemented twice by plugin configuration. Verify there is no duplicate plugin.`);
            }
            commands[plugin.name] = plugin;
            plugin.aliases.forEach((alias: any) => {
                if (typeof commands[alias] !== 'undefined') {
                    throw new Error(`Plugin command alias ${alias} is implemented twice by plugins ${commands[alias].name} and ${plugin.name}. Verify there is no duplicate plugin.`);
                }
                commands[alias] = plugin;
            });
        }
        return {commands, plugins};
    }

    /**
     * Get command name from the message
     * @param message
     */
    public static parseCommand(message: string): {param: string, commandName: string} {
        message = message.trim();
        const commandName = message.split(' ')[0].substr(1).toLowerCase();
        const param = message.substr(commandName.length + 2);
        return {param, commandName};
    }
}
