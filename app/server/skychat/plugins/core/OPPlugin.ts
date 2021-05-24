import { Config } from "../../Config";
import { Connection } from "../../Connection";
import { GlobalPlugin } from "../../GlobalPlugin";
import { UserController } from "../../UserController";


export class OPPlugin extends GlobalPlugin {

    static readonly commandName = 'op';

    readonly minRight = 0;

    readonly rules = {
        op: {
            minCount: 0,
            maxCount: 1,
            coolDown: 1000,
            maxCallsPer10Seconds: 2,
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (! Config.isInOPList(connection.session.identifier)) {
            throw new Error('Not in OP list');
        }
        if (Config.OP_PASSCODE !== null && param !== Config.OP_PASSCODE) {
            throw new Error('Invalid passcode');
        }
        connection.session.setOP(true);
        connection.send('message', UserController.createNeutralMessage({
            id: 0,
            content: 'Your session is now OP. Use with caution.'
        }));
    }
}
