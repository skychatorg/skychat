import { Connection } from '../../skychat/Connection.js';
import { GlobalPlugin } from '../GlobalPlugin.js';
import { PlayerPlugin } from './PlayerPlugin.js';

/**
 * Party channel actions: /party pick <game> in the lobby, /party vote <game> after a round, /party pop <balloon> at Lucky Pop,
 * /party bet <cents> and /party cashout at Crash, /party card <id> at Daily Roll,
 * /party back <monkey> <cents> at Monkey Fight
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
                { name: 'action', pattern: /^(pick|vote|pop|bet|cashout|card|back)$/ },
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
        switch (action) {
            case 'pick':
                return party.pick(connection.session, value);
            case 'vote':
                return party.vote(connection.session, value);
            case 'pop': {
                const luckyPop = party.luckyPop;
                if (!luckyPop) {
                    throw new Error('No balloons here');
                }
                return luckyPop.pop(connection.session, Number(value));
            }
            case 'bet':
            case 'cashout': {
                const crash = party.crash;
                if (!crash) {
                    throw new Error('No crash game here');
                }
                return action === 'bet' ? crash.bet(connection.session, Number(value)) : crash.cashOut(connection.session);
            }
            case 'card': {
                const dailyRoll = party.dailyRoll;
                if (!dailyRoll) {
                    throw new Error('No daily roll here');
                }
                return dailyRoll.pick(connection.session, Number(value));
            }
            case 'back': {
                const monkeyFight = party.monkeyFight;
                if (!monkeyFight) {
                    throw new Error('No monkey fight here');
                }
                return monkeyFight.bet(connection.session, Number(value), Number(amount));
            }
        }
    }
}
