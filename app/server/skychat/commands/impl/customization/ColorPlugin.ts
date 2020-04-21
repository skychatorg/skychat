import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";


export class ColorPlugin extends Plugin {

    static readonly DEFAULT_MAIN: string = '#aaaaaa';

    static readonly DEFAULT_SECONDARY: string = 'rgba(255,255,255,0)';

    readonly defaultDataStorageValue = {main: ColorPlugin.DEFAULT_MAIN, secondary: ColorPlugin.DEFAULT_SECONDARY};

    readonly name = 'color';

    readonly callable = false;

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        throw new Error('This command can not be run');
    }
}
