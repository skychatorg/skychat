import {Connection} from "../../Connection";
import {GlobalPlugin} from "../../GlobalPlugin";
import {ConnectedListPlugin} from "../core/ConnectedListPlugin";
import {UserController} from "../../UserController";


export class MottoPlugin extends GlobalPlugin {

    private static MOTTO_MAX_LENGTH: number = 64;

    static readonly commandName = 'motto';

    static readonly defaultDataStorageValue = '';

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
        await UserController.savePluginData(connection.session.user, this.commandName, param);
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
