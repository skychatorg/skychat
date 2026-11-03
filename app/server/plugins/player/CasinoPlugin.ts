import { Connection } from '../../skychat/Connection.js';
import { GlobalPlugin } from '../GlobalPlugin.js';
import { PlayerPlugin } from './PlayerPlugin.js';

/**
 * Actions at the casino table of the channel you are in: /casino bet 2500 (cents), /casino hit, /casino stand, /casino double
 */
export class CasinoPlugin extends GlobalPlugin {
    static readonly commandName = 'casino';

    // Guests reach the table so they get a clear "log in" error instead of a generic one
    readonly minRight = -1;

    readonly rules = {
        casino: {
            minCount: 1,
            maxCount: 2,
            maxCallsPer10Seconds: 30,
            params: [
                { name: 'action', pattern: /^(bet|hit|stand|double)$/ },
                { name: 'amount', pattern: /^\d{1,9}$/ },
            ],
        },
    };

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        const table = (this.manager.getPlugin(PlayerPlugin.commandName) as PlayerPlugin).channelManager.getSessionChannel(
            connection.session,
        )?.party?.table;
        if (!table) {
            throw new Error('No blackjack table here');
        }

        const [action, amount] = param.split(' ');
        switch (action) {
            case 'bet':
                return table.bet(connection.session, Number(amount));
            case 'hit':
                return table.hit(connection.session);
            case 'stand':
                return table.stand(connection.session);
            case 'double':
                return table.double(connection.session);
        }
    }
}
