import { beforeAll, describe, expect, it } from 'vitest';
import { PlayerChannel } from '../../app/server/plugins/player/PlayerChannel.js';
import { PlayerPlugin } from '../../app/server/plugins/player/PlayerPlugin.js';
import { hand } from './cards.js';
import { settle, TestServer } from './harness.js';

let server: TestServer;
let n = 0;
const name = (prefix: string) => `${prefix}${++n}`;
const player = () => server.roomManager.getPlugin(PlayerPlugin.commandName) as PlayerPlugin;

beforeAll(async () => {
    server = await new TestServer().start();
});

async function op() {
    const admin = await server.connect(name('op'));
    admin.session.setOP(true);
    return admin;
}

/**
 * A casino channel with short timers and the given players seated in it, $200 each (money is in cents)
 */
async function casino(players = 2) {
    const admin = await op();
    await admin.send('/playerchannelmanage create casino 1000 10000 High rollers');
    const channel = player().channelManager.channels.at(-1) as PlayerChannel;
    const table = channel.table!;
    table.timings = { betMs: 80, turnMs: 150, dealerStepMs: 5 };
    const clients = [];
    for (let i = 0; i < players; i++) {
        const client = await server.connect(name('gambler'));
        client.session.user.money = 20000;
        await client.send(`/playerchannel join ${channel.id}`);
        client.clear();
        clients.push(client);
    }
    return { admin, channel, table, clients };
}

/** The shoe for the next hand, first card listed is dealt first: seats, dealer, seats, dealer, then hits */
const stack = (cards: string) => () => hand(cards).reverse();

describe('casino table', () => {
    it('takes the bet and deals as soon as everyone watching has bet', async () => {
        const { table, clients } = await casino(2);
        const [alice, bob] = clients;

        await alice.send('/casino bet 2000');
        expect(alice.session.user.money).toBe(18000);
        expect(alice.last('casino-table')).toMatchObject({ phase: 'betting', seats: [{ bet: 2000, cards: [] }] });

        await bob.send('/casino bet 3000');
        expect(table.sanitized().phase).toBe('playing');
        expect(bob.last('casino-table').seats.map((s: { cards: unknown[] }) => s.cards.length)).toEqual([2, 2]);
    });

    it('never sends the dealer’s hole card before the dealer plays', async () => {
        const { table, clients } = await casino(1);
        table.shuffle = stack('10♠ 9♣ Q♠ 7♦');
        const [alice] = clients;

        await alice.send('/casino bet 2000');

        const payload = alice.last('casino-table');
        expect(payload.phase).toBe('playing');
        expect(payload.dealer).toEqual({ cards: [{ rank: '9', suit: '♣' }, null], total: 9 });
        expect(
            alice
                .events('casino-table')
                .map((p: unknown) => JSON.stringify(p))
                .join(),
        ).not.toContain('"rank":"7","suit":"♦"');
    });

    it('plays a full hand and pays the winners', async () => {
        const { table, clients } = await casino(2);
        // alice 20, bob 16 then hits a 5 for 21, dealer 17 stands
        table.shuffle = stack('10♠ 9♥ 10♣ Q♠ 7♥ 7♦ 5♣');
        const [alice, bob] = clients;
        await alice.send('/casino bet 2000');
        await bob.send('/casino bet 2000');

        await bob.send('/casino hit');
        await alice.send('/casino stand');
        await settle(60);

        const final = alice.last('casino-table');
        expect(final.phase).toBe('waiting');
        expect(final.dealer).toEqual({ cards: hand('10♣ 7♦'), total: 17 });
        expect(final.seats.map((s: { outcome: string; payout: number }) => [s.outcome, s.payout])).toEqual([
            ['win', 4000],
            ['win', 4000],
        ]);
        expect([alice.session.user.money, bob.session.user.money]).toEqual([22000, 22000]);
        expect(alice.last('set-user').money).toBe(22000);
    });

    it('doubles the bet for exactly one more card', async () => {
        const { table, clients } = await casino(1);
        table.shuffle = stack('5♠ 10♣ 6♥ 8♦ 10♥');
        const [alice] = clients;
        await alice.send('/casino bet 2000');

        await alice.send('/casino double');
        await settle(60);

        expect(alice.errors()).toEqual([]);
        expect(alice.last('casino-table').seats[0]).toMatchObject({ bet: 4000, doubled: true, total: 21, outcome: 'win', payout: 8000 });
        expect(alice.session.user.money).toBe(24000);
    });

    it('stands for a player who does not act in time', async () => {
        const { table, clients } = await casino(1);
        table.shuffle = stack('10♠ 10♣ 8♥ 9♦');
        const [alice] = clients;
        await alice.send('/casino bet 2000');

        await settle(220);

        expect(alice.last('casino-table')).toMatchObject({ phase: 'waiting', seats: [{ total: 18, outcome: 'lose' }] });
        expect(alice.session.user.money).toBe(18000);
    });

    it('gives the bet back to a player who leaves before the deal', async () => {
        const { clients } = await casino(2);
        const [alice] = clients;
        await alice.send('/casino bet 2000');

        await alice.send('/playerchannel leave');

        expect(alice.session.user.money).toBe(20000);
        expect(alice.last('casino-table')).toBeNull();
    });

    it('refunds an unfinished hand when the channel is deleted', async () => {
        const { admin, channel, clients } = await casino(1);
        const [alice] = clients;
        await alice.send('/casino bet 5000');
        expect(alice.session.user.money).toBe(15000);

        await admin.send(`/playerchannelmanage delete ${channel.id}`);

        expect(alice.session.user.money).toBe(20000);
    });

    it('refuses guests, bets out of the limits and bets you cannot afford', async () => {
        const { channel, clients } = await casino(1);
        const [alice] = clients;
        const guest = await server.connect(null);
        await guest.send(`/playerchannel join ${channel.id}`);

        await guest.send('/casino bet 2000');
        await alice.send('/casino bet 500');
        await alice.send('/casino bet 50000');
        alice.session.user.money = 1500;
        await alice.send('/casino bet 2000');

        expect(guest.errors()).toEqual(['Log in to play at the casino']);
        expect(alice.errors()).toEqual(['Bets are between $10 and $100', 'Bets are between $10 and $100', 'Not enough money for this bet']);
    });

    it('keeps media and casino commands in their own channels', async () => {
        const { clients } = await casino(1);
        const [alice] = clients;
        await alice.send('/player skip');
        expect(alice.errors()).toEqual(['This channel is a casino, it has no media']);

        const admin = await op();
        await admin.send('/playerchannelmanage create media Music');
        const media = player().channelManager.channels.at(-1) as PlayerChannel;
        await alice.send(`/playerchannel join ${media.id}`);
        alice.clear();
        await alice.send('/casino bet 2000');
        expect(alice.errors()).toEqual(['Join a casino channel first']);
    });
});

describe('managing channels', () => {
    const saved = () => (player() as unknown as { storage: { channels: { id: number; name: string; kind: string }[] } }).storage.channels;

    it('creates, renames, reorders and deletes channels by id, and saves their kind', async () => {
        const admin = await op();
        await admin.send('/playerchannelmanage create media Movie night');
        await admin.send('/playerchannelmanage create casino 500 5000 Back room');
        const [movie, backRoom] = player().channelManager.channels.slice(-2);
        expect([movie.kind, backRoom.kind, backRoom.table?.options]).toEqual([
            'media',
            'casino',
            { game: 'blackjack', minBet: 500, maxBet: 5000 },
        ]);

        await admin.send(`/playerchannelmanage rename ${movie.id} Film club`);
        await admin.send(`/playerchannelmanage reorder ${backRoom.id},${movie.id}`);
        expect(
            saved()
                .slice(0, 2)
                .map((c) => [c.name, c.kind]),
        ).toEqual([
            ['Back room', 'casino'],
            ['Film club', 'media'],
        ]);

        await admin.send(`/playerchannelmanage delete ${backRoom.id}`);
        expect(saved().map((c) => c.id)).not.toContain(backRoom.id);
        expect(admin.errors()).toEqual([]);
    });

    it('rejects bad names and bet limits, and non-OPs', async () => {
        const admin = await op();
        await admin.send('/playerchannelmanage create casino 5000 1000 Upside down');
        await admin.send('/playerchannelmanage create arcade Nope');
        await admin.send(`/playerchannelmanage create media ${'x'.repeat(40)}`);
        const user = await server.connect(name('user'));
        await user.send('/playerchannelmanage create media Mine');

        expect(admin.errors()).toEqual([
            'Bets need a positive minimum, and a maximum at least as high',
            'A channel is either media or casino',
            'Channel names are 1 to 32 characters',
        ]);
        expect(user.errors()).toEqual(['Command only for OP']);
    });
});
