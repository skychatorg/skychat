import { Connection } from '../../skychat/Connection.js';
import { GlobalPlugin } from '../GlobalPlugin.js';
import { PlayerPlugin } from './PlayerPlugin.js';

/**
 * Party channel actions: /party pick <game> in the lobby, /party vote <game> after a round, /party pop <balloon> at Lucky Pop,
 * /party bet <cents> and /party cashout at Crash, /party card <id> at Daily Roll,
 * /party back <monkey> <cents> at Monkey Fight, /party join <cents> and /party pass <seat> at Hot Potato
 */
export class PartyPlugin extends GlobalPlugin {
    static readonly commandName = 'party';

    // Guests reach the party so they get a clear "log in" error instead of a generic one
    readonly minRight = -1;

    readonly rules = {
        party: {
            minCount: 1,
            maxCount: 3,
            maxCallsPer10Seconds: 30,
            params: [
                { name: 'action', pattern: /^(pick|vote|pop|bet|cashout|card|back|join|pass)$/ },
                { name: 'value', pattern: /^[a-z0-9]{1,20}$/ },
                { name: 'amount', pattern: /^[0-9]{1,9}$/ },
            ],
        },
    };

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        const party = (this.manager.getPlugin(PlayerPlugin.commandName) as PlayerPlugin).channelManager.getSessionChannel(
            connection.session,
        )?.party;
        if (!party) {
            throw new Error('Join a party channel first');
        }

        const [action, value, amount] = param.split(' ');
        if (action === 'pick') {
            return party.pick(connection.session, value);
        }
        if (action === 'vote') {
            return party.vote(connection.session, value);
        }
        return party.act(connection.session, action, [Number(value), Number(amount)]);
    }
}
