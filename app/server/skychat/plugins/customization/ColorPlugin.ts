import {Connection} from "../../Connection";
import {Plugin} from "../../Plugin";


export class ColorPlugin extends Plugin {

    static readonly DEFAULT_MAIN: string = '#aaaaaa';

    readonly defaultDataStorageValue = ColorPlugin.DEFAULT_MAIN;

    readonly name = 'color';

    readonly callable = false;

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        throw new Error('This command can not be run');
    }
}
