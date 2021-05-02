import { Plugin } from "./Plugin";
import { Room } from "./Room";
import { Config } from "./Config";
import { RoomPlugin } from "./RoomPlugin";
import { GlobalPlugin } from "./GlobalPlugin";
import { RSA_PKCS1_PADDING } from "constants";
import { RoomManager } from "./RoomManager";
const impl = require('./plugins');


/**
 * Utility class that handles the list of commands and plugins
 */
export class PluginManager {

    public static instantiateRoomPlugins(room: Room): {commands: {[commandName: string]: RoomPlugin}, plugins: RoomPlugin[]} {
        // Initialize command and plugin instances
        const commands: {[pluginName: string]: RoomPlugin} = {};
        const plugins: RoomPlugin[] = [];
        // For every command/plugin
        for (let pluginName of room.enabledPlugins) {
            
            // Check if the command/plugin exists
            if (typeof impl[pluginName] !== 'function') {
                throw new Error(`Unable to load command/plugin ${pluginName}. Ensure the corresponding file is there and the plugin class exported.`);
            }

            // Check plugin type
            const PluginConstructor = impl[pluginName];
            // If plugin is global and in a room, pass
            if (PluginConstructor.isGlobal) {
                continue;
            }

            // Instantiate plugin instance
            const plugin: RoomPlugin = new PluginConstructor(room);
            plugins.push(plugin);

            // Add it in the command object with its name and all its aliases
            if (typeof commands[plugin.commandName] !== 'undefined') {
                throw new Error(`Plugin command ${plugin.commandName} is implemented twice by plugin configuration. Verify there is no duplicate plugin.`);
            }
            commands[plugin.commandName] = plugin;
            PluginConstructor.commandAliases.forEach((commandAlias: any) => {
                if (typeof commands[commandAlias] !== 'undefined') {
                    throw new Error(`Plugin command alias ${commandAlias} is implemented twice by plugins ${commands[commandAlias].commandName} and ${plugin.commandName}. Verify there is no duplicate plugin.`);
                }
                commands[commandAlias] = plugin;
            });
        }
        return {commands, plugins};
    }

    public static instantiateGlobalPlugins(manager: RoomManager): {commands: {[commandName: string]: GlobalPlugin}, plugins: GlobalPlugin[]} {
        // Initialize command and plugin instances
        const commands: {[pluginName: string]: GlobalPlugin} = {};
        const plugins: GlobalPlugin[] = [];
        // For every command/plugin
        for (let pluginName of Config.PLUGINS) {
            
            // Check if the command/plugin exists
            if (typeof impl[pluginName] !== 'function') {
                throw new Error(`Unable to load command/plugin ${pluginName}. Ensure the corresponding file is there and the plugin class exported.`);
            }

            // Check plugin type
            const PluginConstructor = impl[pluginName];
            // If plugin is global and in a room, pass
            if (! PluginConstructor.isGlobal) {
                continue;
            }

            // Instantiate plugin instance
            const plugin: GlobalPlugin = new PluginConstructor(manager);
            plugins.push(plugin);

            // Add it in the command object with its name and all its aliases
            if (typeof commands[plugin.commandName] !== 'undefined') {
                throw new Error(`Plugin command ${plugin.commandName} is implemented twice by plugin configuration. Verify there is no duplicate plugin.`);
            }
            commands[plugin.commandName] = plugin;
            PluginConstructor.commandAliases.forEach((commandAlias: any) => {
                if (typeof commands[commandAlias] !== 'undefined') {
                    throw new Error(`Plugin command alias ${commandAlias} is implemented twice by plugins ${commands[commandAlias].commandName} and ${plugin.commandName}. Verify there is no duplicate plugin.`);
                }
                commands[commandAlias] = plugin;
            });
        }
        return {commands, plugins};
    }

    public static isGlobalPlugin(pluginName: string): boolean {
        const PluginConstructor = impl[pluginName];
        return PluginConstructor && PluginConstructor.isGlobal;
    }

    public static isRoomPlugin(pluginName: string): boolean {
        const PluginConstructor = impl[pluginName];
        return PluginConstructor && ! PluginConstructor.isGlobal;
    }

    /**
     * Load all commands and plugins
     */
    public static getPluginsDefaultDataStorageValues(plugins: string[]) {
        // Initialize command and plugin instances
        const data: {[name: string]: any} = {};
        // For every command/plugin
        for (let pluginName of plugins) {
            // Check if the command/plugin exists
            if (typeof impl[pluginName] !== 'function') {
                throw new Error(`Unable to load command/plugin ${pluginName}. Ensure the corresponding file is there and the plugin class exported.`);
            }
            // Get the constructor
            const PluginConstructor = impl[pluginName];
            data[PluginConstructor.commandName] = PluginConstructor.defaultDataStorageValue;
        }
        return data;
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
