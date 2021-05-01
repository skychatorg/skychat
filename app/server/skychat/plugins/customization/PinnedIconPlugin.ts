import {Connection} from "../../Connection";
import {GlobalPlugin} from "../../GlobalPlugin";


export class PinnedIconPlugin extends GlobalPlugin {

    static readonly commandName = 'pinnedicon';

    static readonly defaultDataStorageValue = '';

    readonly callable = false;

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        throw new Error('This command can not be run');
    }
}
