import { beforeAll, describe, expect, it } from 'vitest';
import { GameMoney } from '../../app/server/plugins/player/GameMoney.js';
import { PlayerChannel } from '../../app/server/plugins/player/PlayerChannel.js';
import { PlayerPlugin } from '../../app/server/plugins/player/PlayerPlugin.js';
import { DatabaseHelper } from '../../app/server/skychat/DatabaseHelper.js';
import { TestServer } from './harness.js';

type Query = { text: string; values: unknown[] };

let server: TestServer;
let n = 0;
const name = (prefix: string) => `${prefix}${++n}`;
/** What the database answers about the games: one row per player, sums as strings, the way pg sends them */
let played: { username: string; net: string; bet: string }[] = [];
/** Every move written for the summary: user id, kind, amount */
const moves: unknown[][] = [];
/** Makes writing a move fail */
let down = false;

beforeAll(async () => {
    server = await new TestServer().start();
    const query = DatabaseHelper.db.query;
    DatabaseHelper.db.query = (async (q: Query) => {
        if (/insert into game_money/i.test(q.text)) {
            if (down) {
                throw new Error('DB down');
            }
            moves.push(q.values.slice(0, 3));
        }
        if (/select[\s\S]*from game_money/i.test(q.text)) {
            return { rows: played };
        }
        return query(q);
    }) as unknown as typeof query;
});

/** The summary as posted in the main room. A new OP every time: the command has a cooldown */
async function summary() {
    const op = await server.connect(name('summaryop'));
    op.session.setOP(true);
    op.clear();
    await op.send('/dailysummary');
    return op.last('message').content as string;
}

describe('daily summary', () => {
    it('names the three biggest winners and losers of the games, and what was bet in all', async () => {
        played = [
            { username: 'Alice', net: '31000', bet: '40000' },
            { username: 'Bob', net: '-28000', bet: '30000' },
            { username: 'Carol', net: '4550', bet: '2000' },
            { username: 'Dave', net: '-9500', bet: '9500' },
            { username: 'Erin', net: '12000', bet: '0' },
            { username: 'Frank', net: '-6000', bet: '20000' },
            { username: 'Grace', net: '100', bet: '5000' },
            { username: 'Heidi', net: '-100', bet: '5000' },
            { username: 'Ivan', net: '0', bet: '12500' },
        ];

        expect(await summary()).toContain(
            '\n\nGames: $1240 bet by 8 players\n- Winners: Alice +$310, Erin +$120, Carol +$45.50\n- Losers: Bob −$280, Dave −$95, Frank −$60',
        );
    });

    it('leaves out the winners or the losers when there are none', async () => {
        played = [{ username: 'Alice', net: '-2000', bet: '2000' }];

        const content = await summary();

        expect(content).toContain('Games: $20 bet by 1 player\n- Losers: Alice −$20');
        expect(content).not.toContain('Winners');
    });

    it('names who won at a free game without counting them as betting', async () => {
        played = [{ username: 'Alice', net: '8000', bet: '0' }];

        expect(await summary()).toContain('Games: $0 bet\n- Winners: Alice +$80');
    });

    it('says nothing about the games when nobody played, or every bet came back', async () => {
        played = [];
        expect(await summary()).not.toContain('Games');

        played = [{ username: 'Alice', net: '0', bet: '0' }];
        expect(await summary()).not.toContain('Games');
    });

    it('still posts the room stats when the games cannot be read', async () => {
        played = null as unknown as typeof played;

        const content = await summary();

        expect(content).toContain('Total: ');
        expect(content).not.toContain('Games');
    });
});

describe('game money', () => {
    it('moves the money and keeps every bet, win and refund', async () => {
        const { user } = (await server.connect(name('gambler'))).session;
        user.money = 5000;
        moves.length = 0;

        await GameMoney.bet(user, 2000, 'Crash bet');
        await GameMoney.win(user, 3000, 'Crash win');
        await GameMoney.refund(user, 2000, 'Crash refund');

        expect(user.money).toBe(8000);
        expect(moves).toEqual([
            [user.id, 'bet', 2000],
            [user.id, 'win', 3000],
            [user.id, 'refund', 2000],
        ]);
    });

    it('keeps nothing of a bet the player cannot afford', async () => {
        const { user } = (await server.connect(name('gambler'))).session;
        user.money = 500;
        moves.length = 0;

        await expect(GameMoney.bet(user, 2000, 'Crash bet')).rejects.toThrow();

        expect(user.money).toBe(500);
        expect(moves).toEqual([]);
    });

    it('moves the money even when the move cannot be kept', async () => {
        const { user } = (await server.connect(name('gambler'))).session;
        user.money = 5000;
        down = true;

        await GameMoney.bet(user, 2000, 'Crash bet');
        down = false;

        expect(user.money).toBe(3000);
    });

    it('keeps what a party game takes and gives back', async () => {
        const admin = await server.connect(name('op'));
        admin.session.setOP(true);
        await admin.send('/playerchannelmanage create party 1000 10000 Fun');
        const player = server.roomManager.getPlugin(PlayerPlugin.commandName) as PlayerPlugin;
        const channel = player.channelManager.channels.at(-1) as PlayerChannel;
        // Two players, so one bet alone does not start the hand
        const [alice, bob] = [await server.connect(name('gambler')), await server.connect(name('gambler'))];
        for (const client of [alice, bob]) {
            client.session.user.money = 20000;
            await client.send(`/playerchannel join ${channel.id}`);
        }
        await alice.send('/party pick blackjack');
        moves.length = 0;

        await alice.send('/casino bet 2000');
        await alice.send('/playerchannel leave');

        expect(moves).toEqual([
            [alice.session.user.id, 'bet', 2000],
            [alice.session.user.id, 'refund', 2000],
        ]);
        await admin.send(`/playerchannelmanage delete ${channel.id}`);
    });
});
