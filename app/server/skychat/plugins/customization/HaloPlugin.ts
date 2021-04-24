import {Connection} from "../../Connection";
import {Plugin} from "../../Plugin";


export class HaloPlugin extends Plugin {

    readonly defaultDataStorageValue = false;

    readonly name = 'halo';

    readonly callable = false;
    
    async run(alias: string, param: string, connection: Connection): Promise<void> {
        throw new Error('This command can not be run');
    }
}
