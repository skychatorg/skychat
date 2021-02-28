import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {ConnectedListPlugin} from "../core/ConnectedListPlugin";
import {Config} from "../../../Config";
import {MessageFormatter} from "../../../MessageFormatter";
import {UserController} from "../../../UserController";
import * as fs from 'fs';


export class AvatarPlugin extends Plugin {

    static readonly DEFAULT_AVATAR: string = Config.LOCATION + '/assets/images/avatars/default.png';

    readonly defaultDataStorageValue = AvatarPlugin.DEFAULT_AVATAR;

    readonly name = 'avatar';

    readonly aliases = [];

    readonly minRight = 0;

    readonly rules = {
        avatar: {
            minCount: 1,
            maxCount: 1,
            coolDown: 1000,
            params: [
                {
                    name: 'avatar',
                    // The following regexp ensures that the given path is path to an uploaded avatar on this server
                    // Security for the image being moved to the avatars directory is ensured through this regexp
                    pattern: new RegExp('^' + MessageFormatter.getInstance().escapeRegExp(Config.LOCATION) + '\/uploads\/([0-9a-zA-Z/-]+)\.(jpg|jpeg|png|webp)$'),
                    info: 'Image link'
                }
            ]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Get local path to image
        const localPath = '.' + param.substr(Config.LOCATION.length);
        const avatarExtension = (localPath.match(/\.[a-z]+$/) || [])[0].substr(1);
        const newAvatarPath = 'avatars/' + connection.session.identifier + '.' + avatarExtension;

        // Check that the given image exists
        if (! fs.existsSync(localPath)) {
            throw new Error('Given image does not exist');
        }

        // Remove previous avatar
        const previousAvatarUrl = UserController.getPluginData(connection.session.user, this.name);
        const previousAvatarLocalPath = '.' + previousAvatarUrl.substr(Config.LOCATION.length).split('?')[0];
        try {
            fs.unlinkSync(previousAvatarLocalPath);
        } catch (error) { }

        // Copy avatar
        fs.copyFileSync(localPath, newAvatarPath);

        // Get new avatar url. Append random string for immediately invalidating cache
        const avatarNewUrl = Config.LOCATION + '/' + newAvatarPath + '?' + new Date().getTime();

        // Save data to database
        await UserController.savePluginData(connection.session.user, this.name, avatarNewUrl);
        (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
