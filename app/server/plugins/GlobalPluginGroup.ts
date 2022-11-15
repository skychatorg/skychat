import { Room } from '../skychat/Room';
import { RoomPlugin, RoomPluginConstructor } from './RoomPlugin';
import { GlobalPlugin, GlobalPluginConstructor } from './GlobalPlugin';
import { PluginGroup } from './PluginGroup';
import { RoomManager } from '../skychat/RoomManager';
import { Config } from '../skychat/Config';

// Load all plugin implementations
import * as impl from './index';
const AllPlugins: {[pluginGroupName: string]: any} = impl;


/**
 * Utility class that handles the list of commands and plugins
 */
class GlobalPluginGroup {
    /**
     * List of plugin groups.
     */
    public readonly pluginGroups: PluginGroup[] = [];

    /**
     * Return an object with the default data storage object for each plugins.
     * This object will be used as default data storage for each user.
     */
    public readonly defaultDataStorageValues: { [pluginName: string]: any } = {};

    /**
     * Create this instance, whose role is to manage the list of plugin groups enabled for the app.
     * If a given name does not exist, an error will be thrown.
     * @param pluginGroupNames
     */
    constructor(pluginGroupNames: string[]) {
        // Verify for each plugin group that it exists
        for (const pluginGroupName of pluginGroupNames) {
            if (typeof AllPlugins[pluginGroupName] !== 'function') {
                throw new Error(`Unable to load command/plugin ${pluginGroupName}. Ensure the corresponding file is there and the plugin class exported.`);
            }

            this.pluginGroups.push(new AllPlugins[pluginGroupName]());
        }

        // For each plugin group, get the default data storage object to build the default data storage for each user
        for (const pluginGroup of this.pluginGroups) {
            for (const RoomPluginClass of pluginGroup.roomPluginClasses) {
                this.defaultDataStorageValues[RoomPluginClass.commandName] = RoomPluginClass.defaultDataStorageValue;
            }
            for (const GlobalPluginClass of pluginGroup.globalPluginClasses) {
                this.defaultDataStorageValues[GlobalPluginClass.commandName] = GlobalPluginClass.defaultDataStorageValue;
            }
        }
    }

    instantiateRoomPlugins(room: Room): RoomPlugin[] {
        const plugins: RoomPlugin[] = [];
        for (const pluginGroup of this.pluginGroups) {
            for (const plugin of pluginGroup.instantiateRoomPlugins(room)) {
                plugins.push(plugin);
            }
        }
        return plugins;
    }

    instantiateGlobalPlugins(manager: RoomManager): GlobalPlugin[] {
        const plugins: GlobalPlugin[] = [];
        for (const pluginGroup of this.pluginGroups) {
            for (const plugin of pluginGroup.instantiateGlobalPlugins(manager)) {
                plugins.push(plugin);
            }
        }
        return plugins;
    }

    extractCommandObjectFromPlugins(plugins: RoomPlugin[] | GlobalPlugin[]): { [commandName: string]: RoomPlugin | GlobalPlugin } {
        const commands: { [commandName: string]: any } = {};
        for (const plugin of plugins) {
            const PluginClass = (plugin.constructor as RoomPluginConstructor | GlobalPluginConstructor);
            commands[PluginClass.commandName] = plugin;
            for (const alias of PluginClass.commandAliases) {
                commands[alias] = plugin;
            }
        }
        return commands;
    }
}

export const globalPluginGroup = new GlobalPluginGroup(Config.PLUGIN_GROUP_NAMES);
