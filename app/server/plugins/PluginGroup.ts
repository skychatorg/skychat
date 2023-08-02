import { Room } from '../skychat/Room';
import { RoomManager } from '../skychat/RoomManager';
import { GlobalPlugin, GlobalPluginConstructor } from './GlobalPlugin';
import { RoomPlugin, RoomPluginConstructor } from './RoomPlugin';

/**
 * Defines a list of plugins that can be used together.
 * Used to make configuration easier.
 */
export abstract class PluginGroup {
    /**
     * List of room plugin classes in this plugin group
     */
    abstract roomPluginClasses: Array<RoomPluginConstructor>;

    /**
     * List of global plugin classes in this plugin group
     */
    abstract globalPluginClasses: Array<GlobalPluginConstructor>;

    /**
     * This method should return the list of instantiated plugins for the given room
     * @param room
     */
    instantiateRoomPlugins(room: Room): RoomPlugin[] {
        return this.roomPluginClasses.map((c) => new c(room));
    }

    /**
     * This method should return the list of instantiated plugins
     * @param manager
     */
    instantiateGlobalPlugins(manager: RoomManager): GlobalPlugin[] {
        return this.globalPluginClasses.map((c) => new c(manager));
    }
}
