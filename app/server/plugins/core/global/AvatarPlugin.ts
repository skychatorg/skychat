import spawn from 'cross-spawn';
import { fileTypeFromFile } from 'file-type';
import fs from 'fs';
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

    static readonly AVATAR_SIZE = 40 * 6; // Miniature size is 40px but we use a larger size for better quality on high-DPI screens

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
        if (!['png', 'jpg', 'jpeg'].includes(extension)) {
            throw new Error('Extension not allowed');
        }

        const fileType = await fileTypeFromFile(localPath);
        if (!fileType || !['image/jpeg', 'image/png'].includes(fileType.mime)) {
            throw new Error('Invalid or unsupported image file');
        }

        const newAvatarPath = 'uploads/avatars/' + connection.session.identifier + '.' + extension;

        // Remove previous avatar
        const previousAvatarUrl = UserController.getUserPluginData<string>(connection.session.user, this.commandName);
        const previousAvatarLocalPath = '.' + previousAvatarUrl.substr(Config.LOCATION.length).split('?')[0];
        if (previousAvatarUrl.match('^uploads/avatars/')) {
            try {
                fs.unlinkSync(previousAvatarLocalPath);
            } catch (error) {
                Logging.warn('Unable to remove previous avatar local path');
            }
        }

        // Resize image using ImageMagick CLI via cross-spawn
        const resizeArgs = [
            '-limit',
            'memory',
            '64',
            '-limit',
            'map',
            '64',
            localPath,
            '-resize',
            `${AvatarPlugin.AVATAR_SIZE}x${AvatarPlugin.AVATAR_SIZE}>`,
            newAvatarPath,
        ];
        const result = spawn.sync('convert', resizeArgs);

        if (result.error || result.status !== 0) {
            Logging.error('Failed to resize avatar with convert', result.stderr?.toString());
            throw new Error('Failed to resize avatar');
        }

        // Get new avatar url. Append random string for immediately invalidating cache
        const avatarNewUrl = Config.LOCATION + '/' + newAvatarPath + '?' + new Date().getTime();

        // Save data to database
        await UserController.savePluginData(connection.session.user, this.commandName, avatarNewUrl);

        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
