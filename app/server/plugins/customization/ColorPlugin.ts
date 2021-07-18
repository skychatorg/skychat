import {Connection} from "../../skychat/Connection";
import {GlobalPlugin} from "../../skychat/GlobalPlugin";


export class ColorPlugin extends GlobalPlugin {

    static readonly DEFAULT_MAIN: string = '#aaaaaa';

    static readonly defaultDataStorageValue = ColorPlugin.DEFAULT_MAIN;

    static readonly commandName = 'color';

    readonly callable = false;

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        throw new Error('This command can not be run');
    }
}
