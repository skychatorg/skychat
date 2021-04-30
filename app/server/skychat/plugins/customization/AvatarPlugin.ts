import {Connection} from "../../Connection";
import {ConnectedListPlugin} from "../core/ConnectedListPlugin";
import {Config} from "../../Config";
import {UserController} from "../../UserController";
import * as fs from 'fs';
import { FileManager } from "../../FileManager";
import { Server } from "../../Server";
import { GlobalPlugin } from "../../GlobalPlugin";


export class AvatarPlugin extends GlobalPlugin {

    static readonly DEFAULT_AVATAR: string = Config.LOCATION + '/assets/images/avatars/default.png';

    static readonly defaultDataStorageValue = AvatarPlugin.DEFAULT_AVATAR;

    static readonly commandName = 'avatar';

    static readonly commandAliases = [];

    readonly minRight = 0;

    readonly rules = {
        avatar: {
            minCount: 1,
            maxCount: 1,
            coolDown: 1000,
            params: [
                {
                    name: 'avatar',
                    pattern: Server.UPLOADED_FILE_REGEXP,
                    info: 'Image link'
                }
            ]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Check that the given image exists
        if (! FileManager.uploadedFileExists(param)) {
            throw new Error('Given image does not exist');
        }

        // Get local path to image
        const localPath = FileManager.getLocalPathFromFileUrl(param);
        const extension = FileManager.getFileExtension(localPath);
        if (['png', 'jpg', 'jpeg'].indexOf(extension) === -1) {
            throw new Error('Extension not allowed');
        }
        const newAvatarPath = 'avatars/' + connection.session.identifier + '.' + extension;

        // Remove previous avatar
        const previousAvatarUrl = UserController.getPluginData(connection.session.user, this.commandName);
        const previousAvatarLocalPath = '.' + previousAvatarUrl.substr(Config.LOCATION.length).split('?')[0];
        if (previousAvatarUrl.match('^avatars\/')) {
            try {
                fs.unlinkSync(previousAvatarLocalPath);
            } catch (error) { }
        }

        // Copy avatar
        fs.copyFileSync(localPath, newAvatarPath);

        // Get new avatar url. Append random string for immediately invalidating cache
        const avatarNewUrl = Config.LOCATION + '/' + newAvatarPath + '?' + new Date().getTime();

        // Save data to database
        await UserController.savePluginData(connection.session.user, this.commandName, avatarNewUrl);

        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
