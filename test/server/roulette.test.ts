import { beforeAll, describe, expect, it } from 'vitest';
import { ROULETTE_SPACES, roulettePayout, WHEEL } from '../../app/api/roulette.js';
import { PlayerChannel } from '../../app/server/plugins/player/PlayerChannel.js';
import { PlayerPlugin } from '../../app/server/plugins/player/PlayerPlugin.js';
import { Roulette } from '../../app/server/plugins/player/party/Roulette.js';
import { settle, TestClient, TestServer } from './harness.js';

let server: TestServer;
let n = 0;
const name = (prefix: string) => `${prefix}${++n}`;
const player = () => server.roomManager.getPlugin(PlayerPlugin.commandName) as PlayerPlugin;

beforeAll(async () => {
    server = await new TestServer().start();
});

async function until(check: () => boolean, ms = 2000) {
    const start = Date.now();
    while (!check()) {
        if (Date.now() - start > ms) throw new Error('Timed out waiting');
        await settle(5);
    }
}

const RED = 37;
const BLACK = 38;

/**
 * A party channel at a $10–$100 Roulette table with short timers, the ball landing on `result`, players with $200 each
 */
async function roulette(players = 1, { result = 1, betMs = 150 } = {}) {
    const admin = await server.connect(name('op'));
    admin.session.setOP(true);
    await admin.send('/playerchannelmanage create party 1000 10000 Wheel');
    const channel = player().channelManager.channels.at(-1) as PlayerChannel;
    const party = channel.party!;
    party.timings = { voteMs: 120, stormEveryMs: 10 };
    party.onGameCreated = (game) => {
        if (game instanceof Roulette) {
            game.timings = { betMs, spinMs: 40, resultsMs: 40 };
            game.random = () => result;
        }
    };
    const clients: TestClient[] = [];
    for (let i = 0; i < players; i++) {
        const client = await server.connect(name('gambler'));
        client.session.user.money = 20000;
        await client.send(`/playerchannel join ${channel.id}`);
        clients.push(client);
    }
    await clients[0].send('/party pick roulette');
    const game = party.gameOf(Roulette)!;
    clients.forEach((client) => client.clear());
    return { party, game, clients };
}

describe('roulette', () => {
    it('pays red 2×, a straight number 36×, and keeps the losing bets', async () => {
        const { clients } = await roulette(2, { result: 1 });
        const [alice, bob] = clients;

        await alice.send(`/party bet ${RED} 1000`);
        await alice.send('/party bet 1 1000');
        await bob.send(`/party bet ${BLACK} 2000`);
        expect([alice.errors(), bob.errors()]).toEqual([[], []]);
        expect(alice.session.user.money).toBe(18000);

        await until(() => alice.last('roulette')?.phase === 'results');
        expect(alice.session.user.money).toBe(18000 + 2000 + 36000);
        expect(bob.session.user.money).toBe(18000);
        expect(alice.last('roulette').results).toEqual(
            expect.arrayContaining([
                { username: alice.session.user.username, won: 38000, net: 36000 },
                { username: bob.session.user.username, won: 0, net: -2000 },
            ]),
        );
    });

    it('takes every outside bet on the zero', async () => {
        const { clients } = await roulette(1, { result: 0 });
        const [alice] = clients;

        await alice.send(`/party bet ${RED} 1000`);
        await alice.send('/party bet 39 1000');
        await alice.send('/party bet 0 1000');

        await until(() => alice.last('roulette')?.phase === 'results');
        expect(alice.session.user.money).toBe(20000 - 3000 + 36000);
    });

    it('refuses guests, bets out of the limits or past the spin total, and bets once the wheel spins', async () => {
        const { party, game, clients } = await roulette(1, { betMs: 800 });
        const [alice] = clients;
        const guest = await server.connect(null);
        await guest.send(`/playerchannel join ${party.channel.id}`);
        alice.session.user.money = 100_000;

        await guest.send(`/party bet ${RED} 1000`);
        await alice.send(`/party bet ${RED} 500`);
        await alice.send(`/party bet ${RED} 20000`);
        await alice.send('/party bet 46 1000');
        for (let i = 0; i < 6; i++) await alice.send(`/party bet ${RED} 10000`);

        expect(guest.errors()).toEqual(['Log in to play Roulette']);
        expect(alice.errors()).toEqual([
            'Bets are $10 to $100',
            'Bets are $10 to $100',
            'Not a place on the table',
            'At most $500 on one spin',
        ]);

        alice.clear();
        await until(() => game['phase'] === 'spinning');
        await alice.send(`/party bet ${RED} 1000`);
        expect(alice.errors()).toEqual(['No more bets']);
    });

    it('feeds 2% of each bet into the Plinko jackpot', async () => {
        const { clients } = await roulette(1, { betMs: 400 });
        const before = player().plinkoJackpot;

        await clients[0].send(`/party bet ${RED} 5000`);

        expect(player().plinkoJackpot).toBe(before + 100);
    });

    it('gives the bets back when a player clears them before the spin', async () => {
        const { clients } = await roulette(1, { betMs: 400 });
        const [alice] = clients;

        await alice.send(`/party bet ${RED} 1000`);
        await alice.send('/party bet 7 2000');
        await alice.send('/party clear');

        expect(alice.session.user.money).toBe(20000);
        expect(alice.last('roulette').bets).toEqual([]);
    });

    it('ends the round when a betting window passes with no bet', async () => {
        const { party } = await roulette(1);
        await until(() => party.sanitized().phase === 'vote');
    });

    it('refunds bets not yet spun, and pays a spin under way, when the round is cut short', async () => {
        const { game, clients } = await roulette(2, { result: 1, betMs: 5000 });
        const [alice, bob] = clients;
        await alice.send(`/party bet ${RED} 1000`);
        await game.destroy();
        expect(alice.session.user.money).toBe(20000);

        const spun = await roulette(1, { result: 1, betMs: 60 });
        await spun.clients[0].send(`/party bet ${RED} 1000`);
        await until(() => spun.game['phase'] === 'spinning');
        await spun.game.destroy();
        expect(spun.clients[0].session.user.money).toBe(20000 + 1000);
        expect(bob.errors()).toEqual([]);
    });
});

describe('roulette rules', () => {
    it('has every pocket once, and gives back exactly 36/37 of any bet on average', () => {
        expect([...WHEEL].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, i) => i));
        for (const space of ROULETTE_SPACES) {
            const back = WHEEL.reduce((sum, result) => sum + roulettePayout(space.id, 37, result), 0) / 37;
            expect(back).toBe(36);
        }
    });
});
