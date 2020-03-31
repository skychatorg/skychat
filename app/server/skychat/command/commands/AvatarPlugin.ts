import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {User} from "../../User";


export class AvatarPlugin extends Plugin {

    static readonly DEFAULT_AVATAR: string = 'https://redsky.fr/picts/galerie/uploaded/2016-01-12/23-55-40-7922eb94a59acfa11a5f-pusheen2.jpg';

    readonly name: string = 'avatar';

    readonly aliases: string[] = [];

    readonly minRight: number = 0;

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const data = User.getPluginData(connection.session.user, AvatarPlugin.name, AvatarPlugin.DEFAULT_AVATAR);
        if (data === param) {
            throw new Error('You already have this avatar');
        }
        await User.savePluginData(connection.session.user, AvatarPlugin.name, param);
    }
}
