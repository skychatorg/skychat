import fs from 'fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Plugin } from '../../app/server/plugins/Plugin.js';
import { BlackjackTable } from '../../app/server/plugins/player/casino/BlackjackTable.js';
import { PlayerChannel } from '../../app/server/plugins/player/PlayerChannel.js';
import { PlayerPlugin } from '../../app/server/plugins/player/PlayerPlugin.js';
import { BALLOONS, LuckyPop } from '../../app/server/plugins/player/party/LuckyPop.js';
import { Crash } from '../../app/server/plugins/player/party/Crash.js';
import { Party } from '../../app/server/plugins/player/party/Party.js';
import { UserController } from '../../app/server/skychat/UserController.js';
import { hand } from './cards.js';
import { settle, TestClient, TestServer } from './harness.js';

let server: TestServer;
let n = 0;
const name = (prefix: string) => `${prefix}${++n}`;
/** What the next pops draw, in order: the prize roll (0 to 99), then which malus when it is one */
const rig = (party: Party, rolls: number[]) => (party.luckyPop!.random = scripted(rolls));
const player = () => server.roomManager.getPlugin(PlayerPlugin.commandName) as PlayerPlugin;

beforeAll(async () => {
    server = await new TestServer().start();
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** Draws from `rolls` first, then the highest value: no golden balloon, a sky in its listed order (ids 0-6 xs, 7-10 md, 11 lg), and the last prize */
/** Wait for a timer-driven change, without guessing how long it takes */
async function until(check: () => boolean, ms = 2000) {
    const start = Date.now();
    while (!check()) {
        if (Date.now() - start > ms) throw new Error('Timed out waiting');
        await settle(5);
    }
}

const scripted = (rolls: number[]) => (max: number) => (rolls.length ? (rolls.shift() as number) : max - 1);

/**
 * A party channel with short timers and the given players in it, $200 each (money is in cents)
 */
async function partyChannel(players = 2, { idleMs = 100 } = {}) {
    const admin = await server.connect(name('op'));
    admin.session.setOP(true);
    await admin.send('/playerchannelmanage create party 1000 10000 Fun');
    const channel = player().channelManager.channels.at(-1) as PlayerChannel;
    const party = channel.party!;
    party.timings = { voteMs: 120, stormEveryMs: 10 };
    party.onGameCreated = (game) => {
        if (game instanceof BlackjackTable) {
            game.timings = { betMs: 40, dealBeatMs: 5, turnMs: 60, dealerStepMs: 2, resultsMs: 20, idleMs };
            // Never a natural: every hand is played out
            game.shuffle = () => hand('10♠ 9♣ 6♠ 7♦ 10♥ 10♦ 10♣').reverse();
        } else if (game instanceof LuckyPop) {
            game.timings = { roundMs: 400, cooldownMs: 60, butterfingersMs: 300, lastPopBeatMs: 20 };
            game.random = scripted([]);
        } else {
            // ×2 every 100 ms
            game.timings = { betMs: 80, beatMs: 10, doubleMs: 100, crashedMs: 40 };
            game.random = scripted([]);
        }
    };
    const clients: TestClient[] = [];
    for (let i = 0; i < players; i++) {
        const client = await server.connect(name('partier'));
        client.session.user.money = 20000;
        await client.send(`/playerchannel join ${channel.id}`);
        clients.push(client);
    }
    clients.forEach((client) => client.clear());
    return { admin, channel, party, clients };
}

describe('party cycle', () => {
    it('starts the game picked in the lobby, once, and only for logged in users', async () => {
        const { party, clients } = await partyChannel(1);
        const guest = await server.connect(null);
        await guest.send(`/playerchannel join ${party.channel.id}`);
        const [alice] = clients;

        await guest.send('/party pick blackjack');
        await alice.send('/party pick chess');
        await alice.send('/party pick luckypop');
        await alice.send('/party pick blackjack');

        expect(guest.errors()).toEqual(['Log in to start a game']);
        expect(alice.errors()).toEqual(['Unknown game', 'A game is already on']);
        expect(party.sanitized()).toMatchObject({ phase: 'playing', game: 'luckypop' });
        expect(alice.last('party')).toMatchObject({ phase: 'playing', game: 'luckypop' });
        expect(alice.last('lucky-pop').balloons).toHaveLength(12);
        // The channel list shows the game on
        expect(alice.last('player-channels').find((c: { id: number }) => c.id === party.channel.id).party).toMatchObject({
            game: 'luckypop',
            minBet: 1000,
        });
    });

    it('ends a blackjack round when nobody bets for a while, and closes the table', async () => {
        const { party, clients } = await partyChannel(1);
        const [alice] = clients;
        await alice.send('/party pick blackjack');

        await settle(150);
        await alice.send('/casino bet 2000');

        expect(party.sanitized()).toMatchObject({ phase: 'vote', lastGame: 'blackjack' });
        expect(alice.last('casino-table')).toBeNull();
        expect(alice.errors()).toEqual(['No blackjack table here']);
    });

    it('ends a blackjack round after 5 hands, never in the middle of one', async () => {
        const { party, clients } = await partyChannel(1, { idleMs: 1000 });
        const [alice] = clients;
        await alice.send('/party pick blackjack');

        for (let i = 0; i < BlackjackTable.ROUND_HANDS; i++) {
            expect(party.sanitized().phase).toBe('playing');
            // Between hands the round shows its hand and when it ends without a bet, during a hand only the hand
            expect(party.table!.sanitized().round).toMatchObject({ hand: i + 1, hands: 5, idleEndsAt: expect.any(Number) });
            await alice.send('/casino bet 1000');
            expect(party.table!.sanitized().round).toMatchObject({ hand: i + 1, idleEndsAt: null });
            // Bet, deal, the turn times out, the dealer plays and the results show
            await settle(160);
        }

        expect(alice.errors()).toEqual([]);
        expect(party.sanitized().phase).toBe('vote');
        // Every hand was settled: 5 times 10♠ 6♠ = 16 against 9♣ 7♦ = 16, the dealer draws 10♥ and busts
        expect(alice.session.user.money).toBe(20000 + 5 * 1000);
    });

    it('starts the game with the most votes, a tie goes to the one not just played, and no votes goes back to the lobby', async () => {
        const { party, clients } = await partyChannel(3, { idleMs: 300 });
        const [alice, bob, carol] = clients;
        const phase = (wanted: string) => until(() => party.sanitized().phase === wanted);
        const guest = await server.connect(null);
        await guest.send(`/playerchannel join ${party.channel.id}`);
        await alice.send('/party pick luckypop');
        await alice.send('/party vote blackjack');
        expect(alice.errors()).toEqual(['There is no vote right now']);

        // The last balloon popped: the round ends
        party.luckyPop!['balloons'].forEach((balloon) => (balloon.popped = balloon.id !== 0));
        await alice.send('/party pop 0');
        await phase('vote');
        expect(party.sanitized()).toMatchObject({ phase: 'vote', lastGame: 'luckypop' });
        expect(alice.last('lucky-pop')).toBeNull();

        // A tie between the two games: the one not just played
        await guest.send('/party vote luckypop');
        expect(guest.errors()).toEqual(['Log in to vote']);
        await alice.send('/party vote luckypop');
        await bob.send('/party vote blackjack');
        expect(alice.last('party').votes).toEqual({ luckypop: [alice.session.user.username], blackjack: [bob.session.user.username] });
        await phase('playing');
        expect(party.sanitized().game).toBe('blackjack');

        // The majority, even for the game just played
        await phase('vote');
        await alice.send('/party vote blackjack');
        await bob.send('/party vote blackjack');
        await carol.send('/party vote luckypop');
        await phase('playing');
        expect(party.sanitized().game).toBe('blackjack');

        // Nobody votes
        await phase('vote');
        await phase('lobby');
        expect(party.sanitized()).toMatchObject({ game: null, deadline: null, votes: {} });
    });

    it('drops the vote of someone who leaves, and goes straight to the lobby when the channel is empty', async () => {
        const { party, clients } = await partyChannel(2);
        const [alice, bob] = clients;
        await alice.send('/party pick blackjack');
        await settle(150);
        await bob.send('/party vote luckypop');
        await bob.send('/playerchannel leave');
        expect(party.sanitized().votes).toEqual({});
        await settle(150);
        expect(party.sanitized().phase).toBe('lobby');

        await alice.send('/party pick blackjack');
        await alice.send('/playerchannel leave');
        await settle(150);
        expect(party.sanitized()).toMatchObject({ phase: 'lobby', deadline: null });
    });

    it('sends the party and its game to someone joining mid-round, and clears them on leaving', async () => {
        const { party, clients } = await partyChannel(1);
        await clients[0].send('/party pick luckypop');
        const dave = await server.connect(name('dave'));
        await dave.send(`/playerchannel join ${party.channel.id}`);
        expect(dave.last('party')).toMatchObject({ phase: 'playing', game: 'luckypop' });
        expect(dave.last('lucky-pop').balloons).toHaveLength(12);

        await dave.send('/playerchannel leave');
        expect([dave.last('party'), dave.last('lucky-pop'), dave.last('casino-table')]).toEqual([null, null, null]);
    });

    it('stops every timer when the channel is deleted', async () => {
        const { admin, party, clients } = await partyChannel(1);
        await clients[0].send('/party pick blackjack');
        await settle(150);
        expect(party.sanitized().phase).toBe('vote');
        await clients[0].send('/party vote luckypop');

        await admin.send(`/playerchannelmanage delete ${party.channel.id}`);
        await settle(200);

        expect(party.game).toBeNull();
        expect(party.sanitized().phase).toBe('vote');
    });

    it('loads a casino channel saved before parties as a party with the same bet limits', async () => {
        const file = `${Plugin.STORAGE_BASE_PATH}/plugins/global/player.json`;
        const casino = {
            id: 1,
            name: 'Old casino',
            kind: 'casino',
            casino: { game: 'blackjack', minBet: 500, maxBet: 5000 },
            schedule: { events: [] },
        };
        const media = { id: 2, name: 'Old media', schedule: { events: [] } };
        fs.writeFileSync(file, JSON.stringify({ channels: [casino, media], lastChannelId: 2 }));

        const fresh = await new TestServer().start();
        const channels = (fresh.roomManager.getPlugin(PlayerPlugin.commandName) as PlayerPlugin).channelManager.channels;

        expect(channels.map((c) => [c.name, c.kind])).toEqual([
            ['Old casino', 'party'],
            ['Old media', 'media'],
        ]);
        expect(channels[0].party?.options).toEqual({ game: 'blackjack', minBet: 500, maxBet: 5000 });
        expect(channels[0].sanitized().party).toMatchObject({ minBet: 500, maxBet: 5000, game: null });
    });
});

describe('lucky pop', () => {
    it('fills a sky with 7 xs, 4 md and 1 lg, and now and then a golden one instead of an md', async () => {
        const { party, clients } = await partyChannel(1);
        await clients[0].send('/party pick luckypop');
        const sizes = (pop: LuckyPop) => pop.sanitizedFor(clients[0].session).balloons.map((b) => b.size);
        expect(sizes(party.luckyPop!).sort()).toEqual([...Array(1).fill('lg'), ...Array(4).fill('md'), ...Array(7).fill('xs')]);

        const golden = new LuckyPop(party, () => {});
        golden.random = scripted([LuckyPop.GOLDEN_CHANCE - 1]);
        golden.start();
        expect(sizes(golden).filter((s) => s === 'golden')).toHaveLength(1);
        expect(sizes(golden).filter((s) => s === 'md')).toHaveLength(3);
        await golden.destroy();
    });

    it('charges the price, pays what was inside, and shows it to everyone', async () => {
        // First xs prize ($1.50), then the second md prize ($20)
        const { party, clients } = await partyChannel(2);
        const [alice, bob] = clients;
        await alice.send('/party pick luckypop');
        rig(party, [0, 45]);

        await alice.send('/party pop 0');
        await bob.send('/party pop 7');

        expect([alice.errors(), bob.errors()]).toEqual([[], []]);
        expect(alice.session.user.money).toBe(20000 - 100 + 150);
        expect(bob.session.user.money).toBe(20000 - 500 + 2000);
        expect(bob.last('lucky-pop').balloons[0]).toMatchObject({
            popped: true,
            result: { username: alice.session.user.username, kind: 'money', amount: 150, label: '+$1.50' },
        });
        expect(alice.session.user.storage.moneyHistory.slice(0, 2).map((m: { reason: string }) => m.reason)).toEqual([
            'Lucky Pop win',
            'Lucky Pop',
        ]);
        expect(party.luckyPop).not.toBeNull();
    });

    it('refuses guests, popped balloons, pops during the cooldown, and pops you cannot afford', async () => {
        const { party, clients } = await partyChannel(2);
        const [alice, bob] = clients;
        const guest = await server.connect(null);
        await guest.send(`/playerchannel join ${party.channel.id}`);
        await alice.send('/party pick luckypop');
        rig(party, [0, 0]);

        await guest.send('/party pop 1');
        const poppedAt = Date.now();
        await alice.send('/party pop 0');
        await alice.send('/party pop 1');
        await bob.send('/party pop 0');
        bob.session.user.money = 1999;
        await bob.send('/party pop 11');
        await alice.send('/party pop 99');

        expect(guest.errors()).toEqual(['Log in to pop balloons']);
        expect(bob.errors()).toEqual(['Someone popped it first', 'This balloon costs $20']);
        expect(alice.errors()).toEqual([expect.stringMatching(/^Wait 1 s before your next pop$/), 'This balloon is gone']);
        expect(alice.last('lucky-pop').you.nextPopAt).toBeGreaterThanOrEqual(poppedAt + 60);
        await settle(70);
        await alice.send('/party pop 1');
        expect(alice.errors()).toHaveLength(2);
    });

    it('lets only one of two players who pop the same balloon at once pay and win', async () => {
        const { party, clients } = await partyChannel(2);
        const [alice, bob] = clients;
        await alice.send('/party pick luckypop');
        const pop = party.luckyPop!;

        const results = await Promise.allSettled([pop.pop(alice.session, 11), pop.pop(bob.session, 11)]);

        expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
        expect(bob.session.user.money).toBe(20000);
        expect(alice.session.user.money).toBeLessThan(20000);
    });

    it('gives the balloon back when paying fails', async () => {
        const { party, clients } = await partyChannel(1);
        const [alice] = clients;
        await alice.send('/party pick luckypop');
        vi.spyOn(UserController, 'buy').mockRejectedValueOnce(new Error('DB down'));

        await alice.send('/party pop 3');

        expect(alice.errors()).toEqual(['DB down']);
        expect(party.luckyPop!.sanitizedFor(alice.session)).toMatchObject({
            balloons: expect.arrayContaining([expect.objectContaining({ id: 3, popped: false })]),
            you: { nextPopAt: 0 },
        });
    });

    it('takes $10 more at most what is left, never below zero', async () => {
        // The lg "lose" prize sits at 90 to 99
        const { party, clients } = await partyChannel(2);
        const [alice, bob] = clients;
        await alice.send('/party pick luckypop');
        rig(party, [95, 95]);
        alice.session.user.money = 2600;
        bob.session.user.money = 2000;

        await alice.send('/party pop 11');
        party.luckyPop!['balloons'][11].popped = false;
        await bob.send('/party pop 11');

        expect(alice.session.user.money).toBe(0);
        expect(alice.session.user.storage.moneyHistory[0]).toMatchObject({ amount: -600, reason: 'Lucky Pop' });
        expect(bob.session.user.money).toBe(0);
        expect(bob.last('lucky-pop').balloons[11].result).toMatchObject({
            kind: 'lose',
            amount: 0,
            label: 'popped in their face, wallet already empty',
        });
        expect(alice.errors()).toEqual([]);
    });

    it('applies maluses: grounded, butterfingers, a sandaled or scrambled next message, and a wizz', async () => {
        // md malus is 70 to 99, then which one: sandale, grounded, scramble. xs malus is 80 to 99: wizz, scramble, butterfingers
        const { party, clients } = await partyChannel(3);
        const [alice, bob, carol] = clients;
        await alice.send('/party pick luckypop');
        rig(party, [85, 1, 85, 0, 90, 0, 90, 2]);

        await alice.send('/party pop 7');
        await alice.send('/party pop 8');
        expect(alice.errors()).toEqual(['You are grounded until the next round']);
        expect(alice.last('lucky-pop').you.grounded).toBe(true);

        await bob.send('/party pop 9');
        await bob.send('/message hello there everyone');
        expect(bob.events('message').at(-1)?.content ?? JSON.stringify(bob.events('message'))).toContain('👞');

        await carol.send('/party pop 0');
        expect(carol.events('wizz')).toHaveLength(1);
        await settle(70);
        await carol.send('/party pop 1');
        await settle(70);
        await carol.send('/party pop 2');
        expect(carol.errors()).toEqual([expect.stringMatching(/^Wait \d s before your next pop$/)]);
        expect(bob.last('lucky-pop').balloons[0].result.label).toBe('wizzed');
        expect(party.luckyPop).not.toBeNull();
    });

    it('sends a wizz storm over time, skipping the ticks while the player is offline', async () => {
        // lg malus at 60 to 89, then the storm
        const { party, clients } = await partyChannel(1);
        const [alice] = clients;
        await alice.send('/party pick luckypop');
        rig(party, [60, 0]);
        await alice.send('/party pop 11');
        await settle(35);
        const before = alice.events('wizz').length;
        expect(before).toBeGreaterThan(0);
        expect(before).toBeLessThan(LuckyPop.STORM_WIZZES);

        const connections = [...alice.session.connections];
        alice.session.connections.length = 0;
        await settle(150);
        alice.session.connections.push(...connections);

        expect(alice.events('wizz').length).toBe(before);
        expect(party['storms'].size).toBe(0);
    });

    it('ends the round on its timer, or right after the last balloon', async () => {
        const { party, clients } = await partyChannel(1);
        await clients[0].send('/party pick luckypop');
        await settle(450);
        expect(party.sanitized()).toMatchObject({ phase: 'vote', lastGame: 'luckypop' });
    });

    it('has positive money odds on every balloon, and chances adding up to 100', () => {
        for (const [size, { price, prizes }] of Object.entries(BALLOONS)) {
            const back = prizes.reduce(
                (sum, p) => sum + (p.chance * (p.kind === 'money' ? p.amount : p.kind === 'lose' ? -p.amount : 0)) / 100,
                0,
            );
            expect(
                prizes.reduce((sum, p) => sum + p.chance, 0),
                size,
            ).toBe(100);
            expect(back, size).toBeGreaterThan(price);
        }
    });
});

describe('crash', () => {
    /** Crash points for the next flights: the roll that gives ×x is 1e6 - 0.99e6 / x */
    const crashAt = (party: Party, ...multipliers: number[]) =>
        (party.crash!.random = scripted(multipliers.map((x) => Math.ceil(1e6 - (0.99e6 * 100) / x))));
    const phase = (party: Party, wanted: string) => until(() => party.crash?.sanitized().phase === wanted);

    it('draws crash points where every target is worth 99% of the bet', () => {
        const game = new Crash({} as Party, () => {});
        game.random = scripted([0, 19802, 500000, 999999]);
        expect([game.drawCrashPoint(), game.drawCrashPoint(), game.drawCrashPoint(), game.drawCrashPoint()]).toEqual([
            100, 101, 198, 10000,
        ]);

        const real = new Crash({} as Party, () => {});
        const draws = Array.from({ length: 40000 }, () => real.drawCrashPoint());
        // Reaching ×1.01 is a 98% chance, ×2 is 49.5%, ×10 is 9.9%: 99% of the bet back whatever the target
        expect(draws.filter((p) => p >= 101).length / draws.length).toBeCloseTo(0.98, 2);
        expect(draws.filter((p) => p >= 200).length / draws.length).toBeCloseTo(0.495, 1);
        expect(draws.filter((p) => p >= 1000).length / draws.length).toBeCloseTo(0.099, 1);
    });

    it('pays the multiplier at the moment you cash out, and nothing to those still in at the crash', async () => {
        const { party, clients } = await partyChannel(2);
        const [alice, bob] = clients;
        await alice.send('/party pick crash');
        crashAt(party, 400);

        await alice.send('/party bet 2000');
        await bob.send('/party bet 1000');
        await phase(party, 'flying');
        // About ×2 after 100 ms
        await settle(70);
        await alice.send('/party cashout');
        await phase(party, 'crashed');

        const [aliceBet, bobBet] = party.crash!.sanitized().bets;
        expect(aliceBet.cashedAt).toBeGreaterThanOrEqual(150);
        expect(aliceBet.cashedAt).toBeLessThan(400);
        expect(aliceBet.payout).toBe(Math.floor((2000 * aliceBet.cashedAt!) / 100));
        expect(alice.session.user.money).toBe(20000 - 2000 + aliceBet.payout!);
        expect(bobBet).toMatchObject({ cashedAt: null, payout: 0 });
        expect(bob.session.user.money).toBe(19000);
        expect(party.crash!.sanitized()).toMatchObject({ crashedAt: 400, history: [400] });
        await bob.send('/party cashout');
        expect(bob.errors()).toEqual(['Nothing to cash out']);
    });

    it('refuses a cash-out that arrives once the multiplier has passed the crash point', async () => {
        const { party, clients } = await partyChannel(1);
        const [alice] = clients;
        await alice.send('/party pick crash');
        crashAt(party, 200);
        await alice.send('/party bet 1000');
        await phase(party, 'flying');

        // ×2 is reached after 100 ms: the crash timer hasn't fired yet, the cash-out comes in just past it
        vi.spyOn(Date, 'now').mockReturnValue(party.crash!.sanitized().startedAt! + 101);
        await alice.send('/party cashout');

        expect(alice.errors()).toEqual(['Too late, it crashed']);
        expect(alice.session.user.money).toBe(19000);
    });

    it('pays once when two cash-outs land together', async () => {
        const { party, clients } = await partyChannel(1);
        const [alice] = clients;
        await alice.send('/party pick crash');
        crashAt(party, 1000);
        await alice.send('/party bet 1000');
        await phase(party, 'flying');

        const results = await Promise.allSettled([party.crash!.cashOut(alice.session), party.crash!.cashOut(alice.session)]);

        expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
        const { payout } = party.crash!.sanitized().bets[0];
        expect(alice.session.user.money).toBe(19000 + payout!);
    });

    it('refuses guests, bets out of limits, a second bet, and bets during a flight', async () => {
        const { party, clients } = await partyChannel(2);
        const [alice, bob] = clients;
        const guest = await server.connect(null);
        await guest.send(`/playerchannel join ${party.channel.id}`);
        await alice.send('/party pick crash');
        party.crash!.timings.betMs = 60_000;
        crashAt(party, 10000, 10000);
        party.crash!['openBets']();

        await guest.send('/party bet 1000');
        await alice.send('/party bet 500');
        await alice.send('/party bet 1000');
        await alice.send('/party bet 1000');
        party.crash!['takeOff']();
        await bob.send('/party bet 1000');

        expect(guest.errors()).toEqual(['Log in to play']);
        expect(alice.errors()).toEqual(['Bets are between $10 and $100', 'You already bet on this flight']);
        expect(bob.errors()).toEqual(['Wait for the next flight']);
    });

    it('takes off once every logged in player has bet, guests do not hold it', async () => {
        const { party, clients } = await partyChannel(1);
        const [alice] = clients;
        const guest = await server.connect(null);
        await guest.send(`/playerchannel join ${party.channel.id}`);
        await alice.send('/party pick crash');
        party.crash!.timings.betMs = 60_000;
        crashAt(party, 10000, 10000);
        party.crash!['openBets']();

        await alice.send('/party bet 1000');
        await phase(party, 'flying');
        expect(guest.last('crash').phase).toBe('flying');
    });

    it('takes off as soon as everyone watching has bet, and refunds a bet taken back by leaving before take-off', async () => {
        const { party, clients } = await partyChannel(2);
        const [alice, bob] = clients;
        await alice.send('/party pick crash');
        party.crash!.timings.betMs = 60_000;
        crashAt(party, 10000, 10000);
        party.crash!['openBets']();

        await alice.send('/party bet 3000');
        await alice.send('/playerchannel leave');
        expect(alice.session.user.money).toBe(20000);

        await bob.send('/party bet 1000');
        await phase(party, 'flying');
        expect(party.crash!.sanitized().bets.map((b) => b.user.username)).toEqual([bob.session.user.username]);
    });

    it('ends the round when a betting window gets no bet, or after 5 flights', async () => {
        const { party, clients } = await partyChannel(1);
        const [alice] = clients;
        await alice.send('/party pick crash');
        await until(() => party.sanitized().phase === 'vote');
        expect(alice.last('crash')).toBeNull();

        await alice.send('/party vote crash');
        await until(() => party.sanitized().game === 'crash');
        crashAt(party, 101, 101, 101, 101, 101);
        for (let i = 1; i <= Crash.FLIGHTS; i++) {
            await until(() => party.crash?.sanitized().phase === 'betting' && party.crash.sanitized().flight === i);
            await alice.send('/party bet 1000');
            await until(() => party.crash?.sanitized().phase !== 'betting' || party.sanitized().phase !== 'playing');
        }
        await until(() => party.sanitized().phase === 'vote');
        expect(party.sanitized().lastGame).toBe('crash');
        expect(alice.session.user.money).toBe(20000 - 5 * 1000);
    });

    it('refunds the bets still riding when the channel is deleted mid-flight', async () => {
        const { admin, party, clients } = await partyChannel(1);
        const [alice] = clients;
        await alice.send('/party pick crash');
        crashAt(party, 10000);
        await alice.send('/party bet 4000');
        await phase(party, 'flying');

        await admin.send(`/playerchannelmanage delete ${party.channel.id}`);
        await settle(30);

        expect(alice.session.user.money).toBe(20000);
    });
});
