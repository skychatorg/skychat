import fs from 'fs';
import sharp from 'sharp';
import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { FileManager } from '../../../skychat/FileManager.js';
import { HttpServer } from '../../../skychat/HttpServer.js';
import { Logging } from '../../../skychat/Logging.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { ConnectedListPlugin } from './ConnectedListPlugin.js';

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
                    pattern: HttpServer.UPLOADED_FILE_REGEXP,
                    info: 'Image link',
                },
            ],
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        // Check that the given image exists
        if (!FileManager.uploadedFileExists(param)) {
            throw new Error('Given image does not exist');
        }

        // Get local path to image
        const localPath = FileManager.getLocalPathFromFileUrl(param);
        const extension = FileManager.getFileExtension(localPath);
        if (['png', 'jpg', 'jpeg'].indexOf(extension) === -1) {
            throw new Error('Extension not allowed');
        }
        const newAvatarPath = 'uploads/avatars/' + connection.session.identifier + '.' + extension;

        // Remove previous avatar if it exists
        const previousAvatarUrl = UserController.getUserPluginData<string>(connection.session.user, this.commandName);
        const previousAvatarLocalPath = '.' + previousAvatarUrl.substr(Config.LOCATION.length).split('?')[0];
        if (previousAvatarUrl.match('^uploads/avatars/')) {
            try {
                fs.unlinkSync(previousAvatarLocalPath);
            } catch (error) {
                Logging.warn('Unable to remove previous avatar local path');
            }
        }

        // Resize and save the new avatar using the sharp library
        try {
            await sharp(localPath).resize({ width: 200, height: 200, fit: 'inside' }).toFile(newAvatarPath);
        } catch (err) {
            Logging.error('Failed to resize avatar', err);
            throw new Error('Failed to resize avatar');
        }

        // Generate new avatar URL with a cache-busting query parameter
        const avatarNewUrl = Config.LOCATION + '/' + newAvatarPath + '?' + new Date().getTime();

        // Save the new avatar URL to the database
        await UserController.savePluginData(connection.session.user, this.commandName, avatarNewUrl);

        // Sync with the connected list plugin
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
