import * as fs from "fs";
import { Config } from "../../skychat/Config";
import { Connection } from "../../skychat/Connection";
import { GlobalPlugin } from "../GlobalPlugin";


export class FileEditorPlugin extends GlobalPlugin {

    static readonly commandName = 'filelist';

    static readonly commandAliases = ['fileget', 'fileset'];

    static readonly ALLOWED_FILES = [
        'config/fakemessages.txt',
        'config/guestnames.txt',
        'config/plugins.txt',
        'config/preferences.json',
        'config/ranks.json',
        'config/stickers.json',
    ];

    readonly opOnly = true;

    readonly rules = {
        filelist: {
            maxCount: 0,
        },
        fileget: {
            minCount: 1,
            maxCount: 1,
        },
        fileset: {
            minCount: 2,
        },
    };
    
    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (alias === 'filelist') {
            return await this.handleFileList(param, connection);
        }

        if (alias === 'fileget') {
            return await this.handleFileGet(param, connection);
        }

        if (alias === 'fileset') {
            return await this.handleFileSet(param, connection);
        }
    }

    /**
     * 
     * @param param 
     * @param connection 
     */
    public async handleFileList(param: string, connection: Connection): Promise<void> {
        connection.send('file-list', FileEditorPlugin.ALLOWED_FILES);
    }

    /**
     * 
     * @param filePath 
     * @param connection 
     */
    public async handleFileGet(filePath: string, connection: Connection): Promise<void> {
        if (FileEditorPlugin.ALLOWED_FILES.indexOf(filePath) === -1) {
            throw new Error('Unable to edit this file');
        }
        connection.send(
            'file-content',
            {
                filePath,
                content: fs.readFileSync(filePath).toString(),
            }
        );
    }

    /**
     * 
     * @param param 
     * @param connection 
     */
    public async handleFileSet(param: string, connection: Connection): Promise<void> {
        const [filePath, ...contentParts] = param.split(' ');
        if (FileEditorPlugin.ALLOWED_FILES.indexOf(filePath) === -1) {
            throw new Error('Unable to edit this file');
        }
        const content = contentParts.join(' ');
        fs.writeFileSync(filePath, content);
        Config.initialize();
        connection.sendInfo('File has been edited');
        // Send file back to the user
        await this.handleFileGet(filePath, connection);
    }
}
