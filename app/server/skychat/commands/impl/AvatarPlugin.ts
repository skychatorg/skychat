import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {User} from "../../User";


export class AvatarPlugin extends Plugin {

    static readonly DEFAULT_AVATAR: string = 'https://risibank.fr/cache/stickers/d216/21623-thumb.png';

    readonly defaultDataStorageValue = AvatarPlugin.DEFAULT_AVATAR;

    readonly name = 'avatar';

    readonly aliases = [];

    readonly minRight = 0;

    readonly rules = {
        minCount: 1,
        maxCount: 1,
        coolDown: 1000,
        params: [
            {
                name: 'avatar',
                pattern: /^https:\/\/redsky.fr\/picts\/galerie\/uploaded\/(.+?).(jpg|png|gif|jpeg|webp)$/,
                info: 'Image link'
            }
        ]
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const data = User.getPluginData(connection.session.user, this.name);
        if (data === param) {
            throw new Error('You already have this avatar');
        }
        await User.savePluginData(connection.session.user, this.name, param);
    }
}
