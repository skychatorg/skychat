import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {User} from "../../User";


export class MotoPlugin extends Plugin {

    private static MOTO_MAX_LENGTH: number = 32;

    readonly defaultDataStorageValue = '';

    readonly name = 'moto';

    readonly minRight = -1;

    readonly rules = {
        minCount: 1,
        maxCount: 1,
        params: [
            {
                name: 'moto',
                pattern: /./,
                info: 'Be inspired'
            }
        ]
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (param.length > MotoPlugin.MOTO_MAX_LENGTH) {
            throw new Error('Moto too long');
        }
        await User.savePluginData(connection.session.user, this.name, param);
    }
}
