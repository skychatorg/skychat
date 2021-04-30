import {Connection} from "../../Connection";
import {GlobalPlugin} from "../../GlobalPlugin";


export class HaloPlugin extends GlobalPlugin {

    static readonly commandName = 'halo';

    static readonly defaultDataStorageValue = false;

    readonly callable = false;
    
    async run(alias: string, param: string, connection: Connection): Promise<void> {
        throw new Error('This command can not be run');
    }
}
