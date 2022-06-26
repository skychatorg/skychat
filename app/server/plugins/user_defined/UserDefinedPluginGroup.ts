import { RoomPlugin, GlobalPlugin } from "..";
import { PluginGroup } from "../PluginGroup";

// All plugins in this group will be loaded for all rooms.
const pluginClasses = Object.values(require('./index.js')) as any[];

export class UserDefinedPluginGroup extends PluginGroup {

    roomPluginClasses = pluginClasses.filter((c: any) => c.prototype instanceof RoomPlugin);
    globalPluginClasses = pluginClasses.filter((c: any) => c.prototype instanceof GlobalPlugin);
}
