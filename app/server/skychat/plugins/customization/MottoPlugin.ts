import {Connection} from "../../Connection";
import {Plugin} from "../../Plugin";
import {ConnectedListPlugin} from "../core/ConnectedListPlugin";
import {UserController} from "../../UserController";


export class MottoPlugin extends Plugin {

    private static MOTTO_MAX_LENGTH: number = 64;

    readonly defaultDataStorageValue = '';

    readonly name = 'motto';

    readonly minRight = 0;

    readonly rules = {
        motto: {
            minCount: 0,
            params: [
                {
                    name: 'motto',
                    pattern: /./,
                    info: 'Be inspired'
                }
            ]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (param.length > MottoPlugin.MOTTO_MAX_LENGTH) {
            throw new Error('Motto too long');
        }
        await UserController.savePluginData(connection.session.user, this.name, param);
        await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
