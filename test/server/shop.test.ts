import { beforeAll, describe, expect, it } from 'vitest';
import { COLOR_RENTALS } from '../../app/api/shop.js';
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
async function shopper(money = COLOR_RENTALS.month.price + COLOR_RENTALS.week.price) {
    const client = await server.connect(`shopper${++n}`, 0);
    client.session.user.money = money;
    client.clear();
    return client;
}

const custom = (client: Awaited<ReturnType<typeof shopper>>) => client.session.user.data.plugins.custom;

const expireColors = () => (server.roomManager.getPlugin('custom') as unknown as { expireColors(): Promise<void> }).expireColors();

describe('colour shop', () => {
    it('refuses a colour that was not rented', async () => {
        const alice = await shopper();

        await alice.send('/custom use color:10');

        expect(alice.errors()).toEqual(['Rent a custom color first']);
        expect(custom(alice).color).toBe(CustomizationPlugin.DEFAULT_COLOR);
    });

    it('rents a colour for a week, shown to everyone', async () => {
        const alice = await shopper();
        const watcher = await server.connect(`watcher${++n}`, 0);
        watcher.clear();

        await alice.send('/custom buy color:10 week');
        await settle(150);

        expect(alice.errors()).toEqual([]);
        expect(alice.session.user.money).toBe(COLOR_RENTALS.month.price);
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
        const alice = await shopper(COLOR_RENTALS.week.price - 1);

        await alice.send('/custom buy color:10 week');

        expect(alice.errors()).toHaveLength(1);
        expect(alice.session.user.money).toBe(COLOR_RENTALS.week.price - 1);
        expect(custom(alice).color).toBe(CustomizationPlugin.DEFAULT_COLOR);
    });

    it('goes back to the default colour once the rental is over', async () => {
        const alice = await shopper();
        await alice.send('/custom buy color:10 week');
        const running = await shopper();
        await running.send('/custom buy color:26 week');
        custom(alice).colorUntil = Date.now() - 1;
        alice.clear();

        await expireColors();

        expect(custom(alice)).toEqual({ color: CustomizationPlugin.DEFAULT_COLOR });
        expect(alice.last('set-user').data.plugins.custom.color).toBe(CustomizationPlugin.DEFAULT_COLOR);
        expect(custom(running).color).toBe(BLUE);
    });

    it('takes back a colour picked when colours were free', async () => {
        const alice = await shopper();
        alice.session.user.data.plugins.custom = { color: RED };

        await expireColors();

        expect(custom(alice).color).toBe(CustomizationPlugin.DEFAULT_COLOR);
    });
});
