import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {User} from "../../../User";
import {ConnectedListPlugin} from "../core/ConnectedListPlugin";
import {UserController} from "../../../UserController";


export class MotoPlugin extends Plugin {

    private static MOTO_MAX_LENGTH: number = 64;

    readonly defaultDataStorageValue = '';

    readonly name = 'moto';

    readonly minRight = 0;

    readonly rules = {
        moto: {
            minCount: 0,
            params: [
                {
                    name: 'moto',
                    pattern: /./,
                    info: 'Be inspired'
                }
            ]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (param.length > MotoPlugin.MOTO_MAX_LENGTH) {
            throw new Error('Moto too long');
        }
        await UserController.savePluginData(connection.session.user, this.name, param);
        await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
