import { beforeAll, describe, expect, it } from 'vitest';
import { SHOP, TITLE_MAX_LENGTH } from '../../app/api/shop.js';
import { CustomizationPlugin } from '../../app/server/plugins/core/global/CustomizationPlugin.js';
import { settle, TestServer } from './harness.js';

const DAY = 24 * 60 * 60 * 1000;
const RED = '#FF4769';
const BLUE = '#4778FF';

let server: TestServer;
let n = 0;

beforeAll(async () => {
    server = await new TestServer().start();
});

/** A user with enough for a month and a week */
async function shopper(money = SHOP.color.prices.month + SHOP.color.prices.week) {
    const client = await server.connect(`shopper${++n}`, 0);
    client.session.user.money = money;
    client.clear();
    return client;
}

const custom = (client: Awaited<ReturnType<typeof shopper>>) => client.session.user.data.plugins.custom;

const expire = () => (server.roomManager.getPlugin('custom') as unknown as { expire(): Promise<void> }).expire();

describe('colour shop', () => {
    it('refuses a colour that was not rented', async () => {
        const alice = await shopper();

        await alice.send('/custom use color:10');

        expect(alice.errors()).toEqual(['Rent the name color in the shop first']);
        expect(custom(alice).color).toBe(CustomizationPlugin.DEFAULT_COLOR);
    });

    it('rents a colour for a week, shown to everyone', async () => {
        const alice = await shopper();
        const watcher = await server.connect(`watcher${++n}`, 0);
        watcher.clear();

        await alice.send('/custom buy color:10 week');
        await settle(150);

        expect(alice.errors()).toEqual([]);
        expect(alice.session.user.money).toBe(SHOP.color.prices.month);
        expect(custom(alice).color).toBe(RED);
        expect(custom(alice).colorUntil).toBeGreaterThan(Date.now() + 7 * DAY - 1000);
        expect(JSON.stringify(watcher.events('connected-list-patch'))).toContain(RED);
    });

    it('lets the renter switch colour for free while the rental runs', async () => {
        const alice = await shopper();
        await alice.send('/custom buy color:10 week');
        const money = alice.session.user.money;

        await alice.send('/custom use color:26');

        expect(alice.errors()).toEqual([]);
        expect(alice.session.user.money).toBe(money);
        expect(custom(alice).color).toBe(BLUE);
    });

    it('adds a new rental to the time left', async () => {
        const alice = await shopper();
        await alice.send('/custom buy color:10 week');
        const until = custom(alice).colorUntil;

        await alice.send('/custom buy color:26 month');

        expect(custom(alice).colorUntil).toBe(until + 30 * DAY);
        expect(alice.session.user.money).toBe(0);
    });

    it('takes nothing from a user who cannot afford it', async () => {
        const alice = await shopper(SHOP.color.prices.week - 1);

        await alice.send('/custom buy color:10 week');

        expect(alice.errors()).toHaveLength(1);
        expect(alice.session.user.money).toBe(SHOP.color.prices.week - 1);
        expect(custom(alice).color).toBe(CustomizationPlugin.DEFAULT_COLOR);
    });

    it('goes back to the default colour once the rental is over', async () => {
        const alice = await shopper();
        await alice.send('/custom buy color:10 week');
        const running = await shopper();
        await running.send('/custom buy color:26 week');
        custom(alice).colorUntil = Date.now() - 1;
        alice.clear();

        await expire();

        expect(custom(alice)).toEqual({ color: CustomizationPlugin.DEFAULT_COLOR });
        expect(alice.last('set-user').data.plugins.custom.color).toBe(CustomizationPlugin.DEFAULT_COLOR);
        expect(custom(running).color).toBe(BLUE);
    });

    it('takes off only what ran out', async () => {
        const alice = await shopper();
        alice.session.user.data.plugins.custom = { color: RED, colorUntil: Date.now() - 1, frame: 'gold', frameUntil: Date.now() + DAY };

        await expire();

        expect(custom(alice)).toEqual({ color: CustomizationPlugin.DEFAULT_COLOR, frame: 'gold', frameUntil: expect.any(Number) });
    });

    it('leaves alone what has nothing to take off', async () => {
        const alice = await shopper();
        alice.clear();

        await expire();

        expect(alice.events('set-user')).toEqual([]);
    });

    it('takes back a colour picked when colours were free', async () => {
        const alice = await shopper();
        alice.session.user.data.plugins.custom = { color: RED };

        await expire();

        expect(custom(alice).color).toBe(CustomizationPlugin.DEFAULT_COLOR);
    });
});

describe('animated names', () => {
    it('rents an effect for a day, and switches it for free', async () => {
        const alice = await shopper();

        await alice.send('/custom buy effect:fire day');
        await alice.send('/custom use effect:ice');

        expect(alice.errors()).toEqual([]);
        expect(alice.session.user.money).toBe(SHOP.color.prices.month + SHOP.color.prices.week - SHOP.effect.prices.day);
        expect(custom(alice).effect).toBe('ice');
        expect(custom(alice).effectUntil).toBeGreaterThan(Date.now() + DAY - 1000);
    });

    it('charges nothing for an effect that does not exist or a duration not sold', async () => {
        const alice = await shopper();
        const money = alice.session.user.money;

        await alice.send('/custom buy effect:sparkles day');
        await alice.send('/custom buy effect:fire month');
        await alice.send('/custom use effect:fire');

        expect(alice.errors()).toEqual([
            'Pick one of the animated names',
            'Choose how long to rent it for: day or week',
            'Rent the animated name in the shop first',
        ]);
        expect(alice.session.user.money).toBe(money);
    });
});

describe('avatar frames', () => {
    it('rents a frame for a week, kept apart from the color', async () => {
        const alice = await shopper();
        await alice.send('/custom buy color:10 week');

        await alice.send('/custom buy frame:neon week');

        expect(alice.errors()).toEqual([]);
        expect(custom(alice)).toMatchObject({ color: RED, frame: 'neon' });
        expect(alice.session.user.money).toBe(SHOP.color.prices.month - SHOP.frame.prices.week);
    });
});

describe('titles', () => {
    it('rents a title with its text, and rewrites it for free', async () => {
        const alice = await shopper();

        await alice.send('/custom buy title week Queen of  Crash');
        await alice.send('/custom use title Lucky Pop addict 🎈');

        expect(alice.errors()).toEqual([]);
        expect(custom(alice).title).toBe('Lucky Pop addict 🎈');
        expect(alice.session.user.money).toBe(SHOP.color.prices.month + SHOP.color.prices.week - SHOP.title.prices.week);
    });

    it('charges nothing for a title too long, empty or spread over lines', async () => {
        const alice = await shopper();
        const money = alice.session.user.money;

        await alice.send(`/custom buy title week ${'a'.repeat(TITLE_MAX_LENGTH + 1)}`);
        await alice.send('/custom buy title week');
        await alice.send('/custom buy title week two\nlines');

        expect(alice.errors()).toEqual(Array(3).fill(`Write a title of up to ${TITLE_MAX_LENGTH} characters`));
        expect(alice.session.user.money).toBe(money);
    });
});
