import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";


export class PinnedIconPlugin extends Plugin {

    readonly defaultDataStorageValue = '';

    readonly name = 'pinnedicon';

    readonly callable = false;

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        throw new Error('This command can not be run');
    }
}
