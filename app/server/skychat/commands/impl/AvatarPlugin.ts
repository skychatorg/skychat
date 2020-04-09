import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {User} from "../../User";
import {ConnectedListPlugin} from "./ConnectedListPlugin";
import {Config} from "../../Config";
import {MessageFormatter} from "../../MessageFormatter";
import {UserController} from "../../UserController";


export class AvatarPlugin extends Plugin {

    static readonly DEFAULT_AVATAR: string = 'https://risibank.fr/cache/stickers/d216/21623-thumb.png';

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
                    pattern: new RegExp('^' + MessageFormatter.getInstance().escapeRegExp(Config.LOCATION) + '\/uploads\/([0-9a-zA-Z/-]+)\.(jpg|jpeg|png|gif|webp)$'),
                    info: 'Image link'
                }
            ]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const data = UserController.getPluginData(connection.session.user, this.name);
        if (data === param) {
            throw new Error('You already have this avatar');
        }
        await UserController.savePluginData(connection.session.user, this.name, param);
        await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
