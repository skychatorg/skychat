import { Connection } from '../../../skychat/Connection';
import { GlobalPlugin } from '../../GlobalPlugin';


export class VoidPlugin extends GlobalPlugin {

    static readonly commandName = 'void';
    readonly minRight = -1;
    readonly hidden = true;
    async run(alias: string, param: string, connection: Connection): Promise<void> { }
}
