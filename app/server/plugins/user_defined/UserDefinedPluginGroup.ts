import fs from 'fs';
import { RoomPlugin, GlobalPlugin } from '../index.js';
import { PluginGroup } from '../PluginGroup.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

// Find all plugins in this directory
const pluginClasses: any[] = fs
    .readdirSync(__dirname)
    .map((fileName: string) => {
        if (!fileName.match(/^(\.d)\.(ts|js)$/)) {
            return null;
        }
        // Require filename
        const loadedFile = require(`./${fileName}`);
        const defaultExport = loadedFile.default || null;
        if (!defaultExport) {
            return null;
        }
        if (!defaultExport.commandName) {
            return null;
        }
        return defaultExport;
    })
    .filter((PluginConstr: any) => !!PluginConstr);

export class UserDefinedPluginGroup extends PluginGroup {
    roomPluginClasses = pluginClasses.filter((c: any) => c.prototype instanceof RoomPlugin);
    globalPluginClasses = pluginClasses.filter((c: any) => c.prototype instanceof GlobalPlugin);
}
