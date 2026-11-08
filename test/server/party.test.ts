import fs from 'fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Plugin } from '../../app/server/plugins/Plugin.js';
import { BlackjackTable } from '../../app/server/plugins/player/casino/BlackjackTable.js';
import { PlayerChannel } from '../../app/server/plugins/player/PlayerChannel.js';
import { PlayerPlugin } from '../../app/server/plugins/player/PlayerPlugin.js';
import { BALLOONS, LuckyPop } from '../../app/server/plugins/player/party/LuckyPop.js';
import { Crash } from '../../app/server/plugins/player/party/Crash.js';
import { DailyRoll } from '../../app/server/plugins/player/party/DailyRoll.js';
import { MonkeyFight, simulate } from '../../app/server/plugins/player/party/MonkeyFight.js';
import { HotPotato } from '../../app/server/plugins/player/party/HotPotato.js';
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
/** Lucky Pop skies with a special balloon at id 0, the hot air one followed by the rolls that keep the sky in order, so its burst roll can come next */
const PEEK = [0, 1];
const PINATA = [0, 2];
const HOT_AIR = [0, 3, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

/**
 * A party channel with short timers and the given players in it, $200 each (money is in cents)
 */
async function partyChannel(players = 2, { idleMs = 100, sky = [] as number[] } = {}) {
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
            game.timings = { roundMs: 400, cooldownMs: 60, butterfingersMs: 300, lastPopBeatMs: 20, hotAirDoubleMs: 100 };
            game.random = scripted([...sky]);
        } else if (game instanceof DailyRoll) {
            game.timings = { pickMs: 800, lastCallMs: 30, countdownMs: 5, flipMs: 1, suspenseMs: 5, afterFlipMs: 1, resultsMs: 30 };
            // Every card $5, the last one the jackpot
            game.random = scripted([]);
        } else if (game instanceof MonkeyFight) {
            game.timings = { betMs: 600, lastCallMs: 20, introMs: 5, beatMs: 2, resultsMs: 30 };
            game.random = scripted([]);
        } else if (game instanceof HotPotato) {
            game.timings = { joinMs: 300, lastCallMs: 20, holdMs: 150, fuseMinMs: 500, fuseMeanMs: 100, fuseMaxMs: 500, resultsMs: 30 };
            // The first holder is the last seat
            game.random = scripted([]);
        } else if (game instanceof Crash) {
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
    it('fills a sky with 7 xs, 4 md and 1 lg, and in most rounds a special one instead of an xs, or an md for the golden one', async () => {
        const { party, clients } = await partyChannel(1);
        await clients[0].send('/party pick luckypop');
        const sizes = (pop: LuckyPop) => pop.sanitizedFor(clients[0].session).balloons.map((b) => b.size);
        expect(sizes(party.luckyPop!).sort()).toEqual(['lg', ...Array(4).fill('md'), ...Array(7).fill('xs')]);

        const golden = new LuckyPop(party, () => {});
        golden.random = scripted([LuckyPop.SPECIAL_CHANCE - 1, 0]);
        golden.start();
        expect(sizes(golden).filter((s) => s === 'golden')).toHaveLength(1);
        expect(sizes(golden).filter((s) => s === 'md')).toHaveLength(3);
        await golden.destroy();

        // Alone, no piñata or hot air balloon: the last special is the peek one
        const solo = new LuckyPop(party, () => {});
        solo.random = scripted([0]);
        solo.start();
        expect(sizes(solo).filter((s) => !['xs', 'md', 'lg'].includes(s))).toEqual(['peek']);
        await solo.destroy();

        const peek = new LuckyPop(party, () => {});
        peek.random = scripted([...PEEK]);
        peek.start();
        expect(sizes(peek)[0]).toBe('peek');
        expect(sizes(peek).filter((s) => s === 'xs')).toHaveLength(6);
        await peek.destroy();
    });

    it('charges the price, pays what was inside, and shows it to everyone', async () => {
        // First xs prize ($1.40), then the second md prize ($20)
        const { party, clients } = await partyChannel(2);
        const [alice, bob] = clients;
        await alice.send('/party pick luckypop');
        rig(party, [0, 45]);

        await alice.send('/party pop 0');
        await bob.send('/party pop 7');

        expect([alice.errors(), bob.errors()]).toEqual([[], []]);
        expect(alice.session.user.money).toBe(20000 - 100 + 140);
        expect(bob.session.user.money).toBe(20000 - 500 + 2000);
        expect(bob.last('lucky-pop').balloons[0]).toMatchObject({
            popped: true,
            result: { username: alice.session.user.username, kind: 'money', amount: 140, label: '+$1.40' },
        });
        expect(alice.session.user.storage.moneyHistory.slice(0, 2).map((m: { reason: string }) => m.reason)).toEqual([
            'Lucky Pop win',
            'Lucky Pop',
        ]);
        expect(party.luckyPop).not.toBeNull();
    });

    it('pays the jackpot on the last roll', async () => {
        const { party, clients } = await partyChannel(1);
        const [alice] = clients;
        await alice.send('/party pick luckypop');
        rig(party, [99]);

        await alice.send('/party pop 0');

        expect(alice.session.user.money).toBe(20000 - 100 + 1000);
        expect(alice.last('lucky-pop').balloons[0].result).toMatchObject({ kind: 'jackpot', amount: 1000, label: 'JACKPOT +$10' });
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
        rig(party, [0]);

        const results = await Promise.allSettled([pop.pop(alice.session, 11), pop.pop(bob.session, 11)]);

        expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
        expect(bob.session.user.money).toBe(20000);
        expect(alice.session.user.money).toBe(20000 - 2000 + 3800);
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
        // The lg "lose" prize sits at 89 to 98
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
        // md malus is 69 to 98, then which one: sandale, grounded, scramble. xs malus is 79 to 98: wizz, scramble, butterfingers
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
        // lg malus at 59 to 88, then the storm
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

    it('bursts the piñata on a 1 in 12 hit, and the burster takes the pot', async () => {
        const { party, clients } = await partyChannel(2, { sky: PINATA });
        const [alice, bob] = clients;
        await alice.send('/party pick luckypop');
        rig(party, [5, 3]);

        await alice.send('/party pop 0');
        await bob.send('/party pop 0');
        expect(alice.last('lucky-pop').balloons[0]).toMatchObject({ popped: false, hits: 2, pot: 200 });
        await settle(70);
        rig(party, [0]);
        await alice.send('/party pop 0');

        expect([alice.errors(), bob.errors()]).toEqual([[], []]);
        expect(alice.session.user.money).toBe(20000 - 200 + 300);
        expect(bob.session.user.money).toBe(20000 - 100);
        expect(bob.last('lucky-pop').balloons[0]).toMatchObject({
            popped: true,
            pot: 300,
            result: { username: alice.session.user.username, kind: 'pinata', amount: 300, label: 'burst the piñata, +$3' },
        });
        await bob.send('/party pop 0');
        expect(bob.errors()).toEqual(['Someone burst it first']);
    });

    it('pays back every hit on a piñata nobody burst', async () => {
        const { party, clients } = await partyChannel(2, { sky: PINATA });
        const [alice, bob] = clients;
        await alice.send('/party pick luckypop');
        rig(party, [5, 3]);
        await alice.send('/party pop 0');
        await bob.send('/party pop 0');
        expect(alice.session.user.money).toBe(19900);

        await until(() => party.sanitized().phase === 'vote');
        await settle(10);

        expect([alice.session.user.money, bob.session.user.money]).toEqual([20000, 20000]);
        expect(alice.session.user.storage.moneyHistory[0]).toMatchObject({ amount: 100, reason: 'Lucky Pop refund' });
    });

    it('lets the hot air balloon grow until someone pops it', async () => {
        const { clients } = await partyChannel(2, { sky: [...HOT_AIR, 750_000] });
        const [alice] = clients;
        await alice.send('/party pick luckypop');
        await settle(110);
        await alice.send('/party pop 0');

        const { result } = alice.last('lucky-pop').balloons[0];
        expect(alice.errors()).toEqual([]);
        expect(result).toMatchObject({ username: alice.session.user.username, kind: 'money' });
        // Doubles every 100 ms in tests, bursts on its own at ×4
        expect(result.amount).toBeGreaterThanOrEqual(1000);
        expect(result.amount).toBeLessThan(2000);
        expect(alice.session.user.money).toBe(20000 - 500 + result.amount);
    });

    it('lets the hot air balloon burst on its own when nobody pops it', async () => {
        const { clients } = await partyChannel(2, { sky: [...HOT_AIR, 750_000] });
        const [alice] = clients;
        await alice.send('/party pick luckypop');
        await settle(230);

        expect(alice.last('lucky-pop').balloons[0]).toMatchObject({ popped: true, result: { kind: 'empty', label: 'burst on its own' } });
        await alice.send('/party pop 0');
        expect(alice.errors()).toEqual(['Someone popped it first']);
    });

    it('shows only the peeker what another balloon holds, and that balloon gives exactly that', async () => {
        const { party, clients } = await partyChannel(2, { sky: PEEK });
        const [alice, bob] = clients;
        await alice.send('/party pick luckypop');
        // The 7th balloon left with a prize is id 7, an md: its second prize, $20
        rig(party, [6, 45]);

        await alice.send('/party pop 0');
        expect(alice.last('lucky-pop').balloons[0].result).toMatchObject({ kind: 'peek', label: 'peeked inside an md balloon' });
        expect(alice.last('lucky-pop').balloons[7].peek).toMatchObject({ kind: 'money', amount: 2000 });
        expect(bob.last('lucky-pop').balloons[7].peek).toBeNull();

        await bob.send('/party pop 7');
        expect(bob.session.user.money).toBe(20000 - 500 + 2000);
        expect(alice.session.user.money).toBe(20000 - 100);
    });

    it('ends the round on its timer, or right after the last balloon', async () => {
        const { party, clients } = await partyChannel(1);
        await clients[0].send('/party pick luckypop');
        await settle(450);
        expect(party.sanitized()).toMatchObject({ phase: 'vote', lastGame: 'luckypop' });
    });

    it('has positive money odds on every balloon, and chances adding up to 100', () => {
        // The piñata, hot air and peek balloons have no prize table
        for (const [size, { price, prizes }] of Object.entries(BALLOONS).filter(([, { prizes }]) => prizes.length)) {
            const back = prizes.reduce(
                (sum, p) =>
                    sum + (p.chance * (p.kind === 'money' || p.kind === 'jackpot' ? p.amount : p.kind === 'lose' ? -p.amount : 0)) / 100,
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

    it('cashes out everyone still riding when the flight reaches the ×100 cap', async () => {
        const { party, clients } = await partyChannel(1);
        const [alice] = clients;
        await alice.send('/party pick crash');
        crashAt(party, 1_000_000);
        await alice.send('/party bet 1000');
        await phase(party, 'crashed');

        expect(party.crash!.sanitized()).toMatchObject({ crashedAt: 10000, bets: [{ cashedAt: 10000, payout: 100000 }] });
        await until(() => alice.session.user.money === 119000);
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

describe('daily roll', () => {
    it('gives one free card each, hides the values, and pays at the reveal once everyone picked', async () => {
        const { party, clients } = await partyChannel(2);
        const [alice, bob] = clients;
        const guest = await server.connect(null);
        await guest.send(`/playerchannel join ${party.channel.id}`);
        await alice.send('/party pick dailyroll');

        await guest.send('/party card 1');
        await alice.send('/party card 0');
        await alice.send('/party card 1');
        await bob.send('/party card 1');
        expect(guest.errors()).toEqual(['Log in to pick a card']);
        expect(bob.errors()).toEqual(['Someone took this card']);
        expect(bob.last('daily-roll').cards.slice(0, 2)).toEqual([
            { id: 0, username: null, amount: null },
            { id: 1, username: alice.session.user.username, amount: null },
        ]);

        // Everyone picked: the clock drops to the last call, and picks can still move
        await bob.send('/party card 0');
        expect(bob.last('daily-roll').deadline).toBeLessThanOrEqual(Date.now() + 30);
        await bob.send('/party card 29');
        expect(bob.errors()).toHaveLength(1);
        await until(() => bob.last('daily-roll')?.phase === 'done');
        // Nothing about the board leaves the server before the reveal starts
        const countdown = bob.events('daily-roll').find((board: { phase: string }) => board.phase === 'countdown');
        expect(countdown.cards.every((card: { amount: number | null }) => card.amount === null)).toBe(true);
        expect(bob.last('daily-roll').cards[29]).toMatchObject({ username: bob.session.user.username, amount: 5000 });
        expect([alice.session.user.money, bob.session.user.money]).toEqual([20500, 25000]);
        await until(() => alice.last('party')?.phase === 'vote');
        expect(alice.last('daily-roll')).toBeNull();
    });

    it('reveals when picks close, and pays only who picked', async () => {
        const { clients } = await partyChannel(2);
        const [alice, bob] = clients;
        await alice.send('/party pick dailyroll');
        await alice.send('/party card 3');

        await until(() => alice.last('daily-roll')?.phase === 'done');
        expect([alice.session.user.money, bob.session.user.money]).toEqual([20500, 20000]);
    });

    it('locks the whole channel until 10 PM once played', async () => {
        const { clients } = await partyChannel(2);
        const [alice, bob] = clients;
        const startedAt = Date.now();
        await alice.send('/party pick dailyroll');
        const unlocksAt = alice.last('party').dailyRollAt;
        expect(unlocksAt).toBe(DailyRoll.nextReset(startedAt));
        expect(new Date(unlocksAt).getHours()).toBe(22);

        await until(() => alice.last('party')?.phase === 'vote');
        await bob.send('/party vote dailyroll');
        expect(bob.errors()).toEqual(['Daily Roll is back at 10 PM']);

        vi.spyOn(Date, 'now').mockReturnValue(unlocksAt);
        await bob.send('/party vote dailyroll');
        expect(bob.errors()).toHaveLength(1);
        expect(bob.last('party').votes).toEqual({ dailyroll: [bob.session.user.username] });
    });
});

describe('monkey fight', () => {
    // The monkeys arrive once their odds are priced
    const phase = (party: Party, wanted: string) =>
        until(() => party.monkeyFight?.sanitized().phase === wanted && party.monkeyFight.sanitized().monkeys.length > 0, 4000);

    it('always ends with one winner, even when every roll misses', () => {
        const game = new MonkeyFight({} as Party, () => {});
        game.random = scripted([]);
        const monkeys = game['drawMonkeys']();
        const { events, winner } = simulate(monkeys, scripted([]));
        expect(events.length).toBeLessThanOrEqual(80);
        expect(monkeys.map((m) => m.id)).toContain(winner);
        expect(new Set(monkeys.map((m) => m.name)).size).toBe(4);
    });

    it('plays every trait by its rules, and the events replay to the fight the server played', () => {
        const game = new MonkeyFight({} as Party, () => {});
        const roll = (max: number) => Math.floor(Math.random() * max);
        game.random = roll;
        const seen = new Set<string>();
        for (let i = 0; i < 400; i++) {
            const monkeys = game['drawMonkeys']();
            expect(new Set(monkeys.map((m) => m.trait)).size).toBe(4);
            const { events, winner } = simulate(monkeys, roll);
            const hp = monkeys.map((m) => m.stats.hp);
            const stunned = new Set<number>();
            events.forEach((event, index) => {
                const { actor, target, kind, amount, gain = 0 } = event;
                const trait = (id: number) => monkeys[id].trait;
                seen.add(kind);
                if (['heal', 'revive'].includes(kind)) {
                    hp[actor] += amount;
                } else {
                    hp[target] -= amount;
                }
                hp[actor] += gain;
                expect(hp.every((value, id) => value >= 0 && value <= monkeys[id].stats.hp)).toBe(true);
                expect(event.ko).toBe(hp[target] === 0 && !['heal', 'revive', 'roar', 'stunned'].includes(kind));
                if (gain) {
                    expect(trait(actor)).toBe('vampire');
                }
                if (kind === 'counter') {
                    expect([trait(actor), events[index - 1].kind, events[index - 1].target]).toEqual(['ninja', 'miss', actor]);
                }
                if (kind === 'revive') {
                    expect([trait(actor), events[index - 1].ko, events[index - 1].target]).toEqual(['zombie', true, actor]);
                    expect(events.filter((e) => e.kind === 'revive' && e.actor === actor)).toHaveLength(1);
                }
                if (kind === 'roar') {
                    expect(trait(actor)).toBe('gorilla');
                    monkeys.forEach((m) => m.id !== actor && hp[m.id] > 0 && stunned.add(m.id));
                }
                if (kind === 'stunned') {
                    expect(stunned.delete(actor)).toBe(true);
                }
            });
            expect(hp[winner]).toBeGreaterThan(0);
        }
        expect([...seen].sort()).toEqual(['counter', 'crit', 'heal', 'hit', 'miss', 'revive', 'roar', 'stunned', 'trip']);
    });

    it('prices every monkey fairly, so a bet is worth its stake on average', async () => {
        const game = new MonkeyFight({} as Party, () => {});
        const monkeys = game['drawMonkeys']();
        const odds = await game.computeOdds(monkeys);
        // Odds are 1 / chance: the chances they imply add up to about 1
        expect(odds.reduce((sum, o) => sum + 100 / o, 0)).toBeCloseTo(1, 1);
        odds.forEach((o) => expect(o).toBeGreaterThanOrEqual(101));
    });

    it('takes one bet per player, hides traits and the fight while betting, and pays the winners when the fight is over', async () => {
        const { party, clients } = await partyChannel(2);
        const [alice, bob] = clients;
        const guest = await server.connect(null);
        await guest.send(`/playerchannel join ${party.channel.id}`);
        await alice.send('/party pick monkeys');
        await phase(party, 'betting');

        const betting = alice.last('monkey-fight');
        expect(betting.monkeys).toHaveLength(4);
        expect(betting.monkeys.every((m: { trait: unknown }) => m.trait === null)).toBe(true);
        expect(betting.events).toBeNull();

        await guest.send('/party back 0 1000');
        await alice.send('/party back 9 1000');
        expect(guest.errors()).toEqual(['Log in to play']);
        expect(alice.errors()).toEqual(['No such monkey']);

        // Switching monkey or amount only moves the difference
        await alice.send('/party back 1 3000');
        await alice.send('/party back 0 1000');
        expect(alice.errors()).toHaveLength(1);
        expect(alice.session.user.money).toBe(19000);
        expect(party.monkeyFight!.sanitized().bets).toMatchObject([{ monkey: 0, bet: 1000 }]);

        // Bob backs every monkey but Alice's, so one of the two wins
        await bob.send('/party back 1 1000');
        await until(() => party.monkeyFight?.sanitized().phase === 'fighting');
        const fight = party.monkeyFight!.sanitized();
        expect(fight.monkeys.every((m) => m.trait !== null)).toBe(true);
        // Nobody is paid before the last punch
        expect([alice.session.user.money, bob.session.user.money]).toEqual([19000, 19000]);

        await phase(party, 'done');
        const done = party.monkeyFight!.sanitized();
        const winners = done.bets.filter((b) => b.payout);
        winners.forEach((b) => expect(b.payout).toBe(Math.floor((b.bet * done.monkeys[b.monkey].odds) / 100)));
        await until(() => alice.session.user.money + bob.session.user.money === 38000 + winners.reduce((s, b) => s + b.payout!, 0));
    });

    it('ends the round when nobody bets, and refunds bets still open when the game is destroyed', async () => {
        const { party, clients } = await partyChannel(2);
        const [alice] = clients;
        await alice.send('/party pick monkeys');
        await phase(party, 'betting');
        await alice.send('/party back 2 1000');
        expect(alice.session.user.money).toBe(19000);
        await party.monkeyFight!.destroy();
        expect(alice.session.user.money).toBe(20000);

        const other = await partyChannel(1);
        await other.clients[0].send('/party pick monkeys');
        await until(() => other.party.sanitized().phase !== 'playing', 4000);
    });
});

describe('hot potato', () => {
    const phase = (party: Party, wanted: string) => until(() => party.hotPotato?.sanitized().phase === wanted, 4000);
    const money = (clients: TestClient[]) => clients.map((c) => c.session.user.money);

    it('refuses guests and second seats, and refunds a player left alone', async () => {
        const { party, clients } = await partyChannel(2);
        const [alice] = clients;
        const guest = await server.connect(null);
        await guest.send(`/playerchannel join ${party.channel.id}`);
        await alice.send('/party pick potato');

        await guest.send('/party join 1000');
        await alice.send('/party join 2000');
        await alice.send('/party join 2000');
        expect(guest.errors()).toEqual(['Log in to play']);
        expect(alice.errors()).toEqual(['You are already in']);
        expect(alice.session.user.money).toBe(18000);

        await until(() => party.sanitized().phase !== 'playing', 4000);
        expect(alice.session.user.money).toBe(20000);
    });

    it('holds everyone to the first stake, and sends the bomb where the holder aimed once the hold ends', async () => {
        const { party, clients } = await partyChannel(3);
        const [alice, bob, carol] = clients;
        await alice.send('/party pick potato');
        await alice.send('/party join 1000');
        await bob.send('/party join 1000');
        await carol.send('/party join 5000');
        await carol.send('/party join 1000');
        expect(carol.session.user.money).toBe(19000);
        await phase(party, 'playing');
        // Carol, last seat, holds it first
        expect(party.hotPotato!.sanitized().holder).toBe(2);

        await alice.send('/party pass 1');
        await carol.send('/party pass 2');
        // Picked during the hold: kept, and sent the moment the hold ends
        await carol.send('/party pass 0');
        expect(party.hotPotato!.sanitized()).toMatchObject({ holder: 2, aim: 0 });
        await until(() => party.hotPotato!.sanitized().holder === 0);
        expect(party.hotPotato!.sanitized()).toMatchObject({ aim: null, pot: 3100, passCount: 1 });
        expect(carol.session.user.money).toBe(18900);

        // Straight back to whoever sent it is fine
        await settle(170);
        await alice.send('/party pass 2');
        expect(party.hotPotato!.sanitized().holder).toBe(2);
        expect(alice.errors()).toEqual(['You are not holding the bomb']);
        expect(carol.errors()).toEqual(['The stake is $10', 'Pass it to someone else']);
        expect(bob.errors()).toEqual([]);
    });

    it('blows up on the holder, and splits the pot evenly when no survivor ever held it', async () => {
        const { party, clients } = await partyChannel(4);
        await clients[0].send('/party pick potato');
        for (const client of clients) {
            await client.send('/party join 1000');
        }
        await phase(party, 'done');

        const done = party.hotPotato!.sanitized();
        expect(done.loser).toBe(3);
        expect(done.players.map((p) => p.payout)).toEqual([1334, 1333, 1333, 0]);
        await until(() => clients[0].session.user.money === 20334);
        // Nothing created, nothing taken: money only moved between players
        expect(money(clients).reduce((a, b) => a + b)).toBe(80000);
    });

    it('shares the whole pot between survivors by how long each held the bomb', async () => {
        const { party, clients } = await partyChannel(3);
        const [alice, bob, carol] = clients;
        await alice.send('/party pick potato');
        for (const client of clients) {
            await client.send('/party join 1000');
        }
        await phase(party, 'playing');
        // Carol holds it a moment, passes to Alice, and it blows up on Alice
        await settle(170);
        await carol.send('/party pass 0');
        await phase(party, 'done');

        // Bob survived without ever holding it: nothing. Carol is the only survivor who held it: the whole pot
        expect(party.hotPotato!.sanitized().players.map((p) => p.payout)).toEqual([0, 0, 3100]);
        await until(() => carol.session.user.money === 22000);
        expect([alice.session.user.money, bob.session.user.money]).toEqual([19000, 19000]);
    });

    it('keeps the bomb on a holder who leaves, and never passes it to someone who left', async () => {
        const { party, clients } = await partyChannel(3);
        const [alice, , carol] = clients;
        await alice.send('/party pick potato');
        for (const client of clients) {
            await client.send('/party join 1000');
        }
        await phase(party, 'playing');
        await alice.send('/playerchannel leave');
        await settle(170);
        await carol.send('/party pass 0');
        expect(carol.errors()).toEqual([`${alice.session.user.username} left the table`]);

        await carol.send('/playerchannel leave');
        expect(party.hotPotato!.sanitized().holder).toBe(2);
        await phase(party, 'done');
        expect(party.hotPotato!.sanitized().loser).toBe(2);
    });

    it('gives back stakes and fees when the game is torn down mid-round', async () => {
        const { party, clients } = await partyChannel(3);
        const [alice, , carol] = clients;
        await alice.send('/party pick potato');
        for (const client of clients) {
            await client.send('/party join 1000');
        }
        await phase(party, 'playing');
        await settle(170);
        await carol.send('/party pass 0');
        await until(() => party.hotPotato!.sanitized().pot === 3100);

        await party.hotPotato!.destroy();
        expect(money(clients)).toEqual([20000, 20000, 20000]);
    });
});
