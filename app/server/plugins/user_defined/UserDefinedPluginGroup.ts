const fs = require('fs');
import { RoomPlugin, GlobalPlugin } from "..";
import { PluginGroup } from "../PluginGroup";


// Find all plugins in this directory
const pluginClasses: any[] = fs.readdirSync(__dirname)
    .map((fileName: string) => {
        if (! fileName.match(/\.(ts|js)$/)) {
            return null;
        }
        // Require filename
        const loadedFile = require(`./${fileName}`);
        const defaultExport = loadedFile.default || null;
        if (! defaultExport) {
            return null;
        }
        if (! defaultExport.commandName) {
            return null;
        }
        return defaultExport;
    })
    .filter((PluginConstr: any) => !! PluginConstr);

export class UserDefinedPluginGroup extends PluginGroup {

    roomPluginClasses = pluginClasses.filter((c: any) => c.prototype instanceof RoomPlugin);
    globalPluginClasses = pluginClasses.filter((c: any) => c.prototype instanceof GlobalPlugin);
}
