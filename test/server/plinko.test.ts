import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { UserController } from '../../app/server/skychat/UserController.js';
import { PLINKO, PLINKO_SLOTS, PLINKO_SMALL_WINS, plinkoPath, plinkoTimes } from '../../app/api/plinko.js';
import { PlayerChannel } from '../../app/server/plugins/player/PlayerChannel.js';
import { PlayerPlugin } from '../../app/server/plugins/player/PlayerPlugin.js';
import { Plinko } from '../../app/server/plugins/player/party/Plinko.js';
import { settle, TestClient, TestServer } from './harness.js';

let server: TestServer;
let n = 0;
const name = (prefix: string) => `${prefix}${++n}`;
const player = () => server.roomManager.getPlugin(PlayerPlugin.commandName) as PlayerPlugin;

beforeAll(async () => {
    server = await new TestServer().start();
});

afterEach(() => {
    vi.restoreAllMocks();
});

async function until(check: () => boolean, ms = 2000) {
    const start = Date.now();
    while (!check()) {
        if (Date.now() - start > ms) throw new Error('Timed out waiting');
        await settle(5);
    }
}

/** Draws from `rolls` first, then the highest value: no jackpot, nothing won, a plain path */
const scripted = (rolls: number[]) => (max: number) => (rolls.length ? (rolls.shift() as number) : max - 1);
/** The rolls of one drop: the jackpot roll, then the small win roll, then which of its slots */
const JACKPOT = [0, 0];
const FIVE_TIMES = [1, 0];

/**
 * A party channel playing Plinko with short timers, and players with $200 each (money is in cents)
 */
async function plinko(players = 1, { flightMs = 40, rolls = [] as number[] } = {}) {
    const admin = await server.connect(name('op'));
    admin.session.setOP(true);
    await admin.send('/playerchannelmanage create party 1000 10000 Plinko');
    const channel = player().channelManager.channels.at(-1) as PlayerChannel;
    const party = channel.party!;
    party.timings = { voteMs: 120, stormEveryMs: 10 };
    party.onGameCreated = (game) => {
        if (game instanceof Plinko) {
            game.timings = { idleMs: 300, roundMs: 5000, maxBalls: 20, windowMs: 20_000 };
            game.flightMs = () => flightMs;
            game.random = scripted(rolls);
        }
    };
    const clients: TestClient[] = [];
    for (let i = 0; i < players; i++) {
        const client = await server.connect(name('dropper'));
        client.session.user.money = 20000;
        await client.send(`/playerchannel join ${channel.id}`);
        clients.push(client);
    }
    await clients[0].send('/party pick plinko');
    const game = party.gameOf(Plinko)!;
    clients.forEach((client) => client.clear());
    return { party, game, clients };
}

describe('plinko', () => {
    it('charges $10 a ball, adds $4 to the jackpot, and pays only when the ball lands', async () => {
        const { clients } = await plinko(1, { rolls: [...FIVE_TIMES] });
        const [alice] = clients;
        const jackpot = player().plinkoJackpot;

        await alice.send('/party drop');
        expect(alice.errors()).toEqual([]);
        expect(alice.session.user.money).toBe(20000 - PLINKO.ballPrice);
        expect(player().plinkoJackpot).toBe(jackpot + PLINKO.toJackpot);
        expect(alice.last('plinko').balls).toHaveLength(1);

        await until(() => alice.last('plinko')?.recent.length === 1);
        expect(alice.session.user.money).toBe(20000 - PLINKO.ballPrice + 5 * PLINKO.ballPrice);
        expect(alice.last('plinko').recent[0]).toMatchObject({ win: 5 * PLINKO.ballPrice, jackpot: false });
    });

    it('takes a burst of balls back to back', async () => {
        const { clients } = await plinko(1);
        const [alice] = clients;

        for (let i = 0; i < 10; i++) await alice.send('/party drop');

        expect(alice.errors()).toEqual([]);
        expect(alice.session.user.money).toBe(20000 - 10 * PLINKO.ballPrice);
        expect(alice.last('plinko').you.drops).toHaveLength(10);
    });

    it('refuses guests, balls past the limit of the window, and players who cannot pay', async () => {
        const { party, game, clients } = await plinko(2);
        const [alice, bob] = clients;
        const guest = await server.connect(null);
        await guest.send(`/playerchannel join ${party.channel.id}`);
        game.timings.maxBalls = 2;
        bob.session.user.money = PLINKO.ballPrice - 1;

        await guest.send('/party drop');
        for (let i = 0; i < 3; i++) await alice.send('/party drop');
        await bob.send('/party drop');

        expect(guest.errors()).toEqual(['Log in to play Plinko']);
        expect(alice.errors()).toEqual(['2 balls every 20 s at most, wait 20 s']);
        expect(alice.last('plinko').you).toMatchObject({ maxBalls: 2, windowMs: 20_000 });
        expect(bob.errors()).toEqual(['A ball costs $10']);
        expect(alice.session.user.money).toBe(20000 - 2 * PLINKO.ballPrice);
    });

    it('reserves the jackpot when drawn, shows nothing of it while the ball falls, and pays it on landing', async () => {
        const { clients } = await plinko(1, { rolls: [...JACKPOT], flightMs: 200 });
        const [alice] = clients;
        const before = player().plinkoJackpot;

        await alice.send('/party drop');
        // The pot restarts, but the meters move as for any ball: nobody can tell a jackpot is falling
        expect(player().plinkoJackpot).toBe(PLINKO.jackpotStart);
        expect(alice.last('plinko').jackpot).toBe(before + PLINKO.toJackpot);
        await alice.send('/party drop');
        expect(alice.last('plinko').jackpot).toBe(before + 2 * PLINKO.toJackpot);
        // Nothing paid before landing
        expect(alice.session.user.money).toBe(20000 - 2 * PLINKO.ballPrice);

        await until(() => alice.last('plinko')?.recent.length === 2);
        await settle(20);
        expect(alice.session.user.money).toBe(20000 - 2 * PLINKO.ballPrice + before + PLINKO.toJackpot);
        expect(alice.last('plinko').jackpot).toBe(PLINKO.jackpotStart + PLINKO.toJackpot);
    });

    it('refunds a ball paid for just as the round ended', async () => {
        const { game, clients } = await plinko(1);
        const [alice] = clients;
        // The round ends while the payment is under way
        const buy = UserController.buy;
        vi.spyOn(UserController, 'buy').mockImplementationOnce(async (...args) => {
            await buy.apply(UserController, args);
            await game.destroy();
        });

        await alice.send('/party drop');

        expect(alice.errors()).toEqual(['This round is over']);
        expect(alice.session.user.money).toBe(20000);
    });

    it('never pays the same jackpot twice when two balls hit it', async () => {
        const { game, clients } = await plinko(2, { rolls: [...JACKPOT] });
        const [alice, bob] = clients;
        const before = player().plinkoJackpot;

        await alice.send('/party drop');
        game.random = scripted([...JACKPOT]);
        await bob.send('/party drop');
        await until(() => alice.last('plinko')?.recent.length === 2);
        await settle(20);

        expect(alice.session.user.money).toBe(20000 - PLINKO.ballPrice + before + PLINKO.toJackpot);
        expect(bob.session.user.money).toBe(20000 - PLINKO.ballPrice + PLINKO.jackpotStart + PLINKO.toJackpot);
    });

    it('saves the win of every ball in the air, and pays them after a restart', async () => {
        const { clients } = await plinko(1, { rolls: [...FIVE_TIMES], flightMs: 10_000 });
        const [alice] = clients;
        const plugin = player();
        await alice.send('/party drop');
        const jackpot = plugin.reservePlinkoJackpot('falling-jackpot', alice.session.user.id, alice.session.user.username);
        expect(plugin.plinkoJackpotShown).toBe(jackpot);

        // What the plugin does when the server starts again
        await (plugin as unknown as { payLeftoverPlinkoWins: () => Promise<void> }).payLeftoverPlinkoWins();

        expect(alice.session.user.money).toBe(20000 - PLINKO.ballPrice + 5 * PLINKO.ballPrice + jackpot);
        expect(plugin.plinkoJackpotShown).toBe(plugin.plinkoJackpot);
    });

    it('pays the balls still falling when the round is cut short', async () => {
        const { game, clients } = await plinko(1, { rolls: [...FIVE_TIMES], flightMs: 10_000 });
        const [alice] = clients;

        await alice.send('/party drop');
        await game.destroy();

        expect(alice.session.user.money).toBe(20000 - PLINKO.ballPrice + 5 * PLINKO.ballPrice);
    });

    it('ends the round once nobody drops for a while, never with a ball in the air', async () => {
        const { party, game, clients } = await plinko(1, { flightMs: 400 });
        const [alice] = clients;
        game.timings.idleMs = 100;

        await alice.send('/party drop');
        await settle(200);
        expect(party.sanitized().phase).toBe('playing');
        await until(() => party.sanitized().phase === 'vote');
    });
});

describe('plinko rules', () => {
    it('gives back exactly half of each ball in small wins, so nothing is created', () => {
        const smallWins = PLINKO_SMALL_WINS.reduce((sum, { multiplier, chance }) => sum + multiplier * chance, 0) / 10_000;
        expect(smallWins).toBe(0.5);
        // What the house keeps pays each restart: $1 a ball, over the balls a jackpot takes on average
        const house = PLINKO.ballPrice - PLINKO.toJackpot - smallWins * PLINKO.ballPrice;
        expect(house * PLINKO.jackpotOdds).toBe(PLINKO.jackpotStart);
    });

    it('builds paths that always land in their slot, with a time for every row', () => {
        const random = (max: number) => Math.floor(Math.random() * max);
        PLINKO_SLOTS.forEach((_, slot) => {
            for (let i = 0; i < 300; i++) {
                const path = plinkoPath(slot, random);
                expect(path).toHaveLength(PLINKO.rows);
                expect(path.filter(Boolean).length).toBe(slot);
                expect(plinkoTimes(path)).toHaveLength(PLINKO.rows + 1);
            }
        });
    });
});
