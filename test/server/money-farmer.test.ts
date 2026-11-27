import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MoneyFarmerPlugin } from '../../app/server/plugins/games/global/MoneyFarmerPlugin.js';
import { TestServer } from './harness.js';

let server: TestServer;
let farmer: MoneyFarmerPlugin;

beforeAll(async () => {
    server = await new TestServer().start();
    farmer = server.roomManager.getPlugin('moneyfarmer') as MoneyFarmerPlugin;
});

afterEach(() => {
    vi.restoreAllMocks();
});

const player = async (username: string, money: number) => {
    const client = await server.connect(username, 0);
    client.session.user.money = money;
    return client;
};

describe('money farmer', () => {
    it('pays chatty players by the minute, more when they have less', async () => {
        const players = await Promise.all([player('farmpoor', 500), player('farmmid', 2000), player('farmrich', 20000)]);
        const quiet = await player('farmquiet', 500);
        quiet.session.lastPublicMessageSentDate = new Date(Date.now() - 6 * 60 * 1000);

        // The first tick pays the day's allowance: the second shows the pay alone
        await farmer['tick']();
        players.forEach((p, i) => (p.session.user.money = [500, 2000, 20000][i]));
        await farmer['tick']();

        expect(players.map((p) => p.session.user.money)).toEqual([515, 2005, 20000]);
        expect(quiet.session.user.money).toBe(500);
    });

    it('pays an allowance the first time a player chats each day, more for each day in a row', async () => {
        const regular = await player('farmregular', 0);
        const day = 24 * 60 * 60 * 1000;
        const start = Date.now();
        const tickOn = async (dayOffset: number) => {
            vi.spyOn(Date, 'now').mockReturnValue(start + dayOffset * day);
            regular.session.lastPublicMessageSentDate = new Date(Date.now());
            regular.session.user.money = 20000;
            await farmer['tick']();
            return regular.session.user.money - 20000;
        };

        expect(await tickOn(0)).toBe(2000);
        expect(regular.last('allowance')).toBe('Daily allowance: $20. Come back tomorrow for $25');
        // Once a day only
        expect(await tickOn(0)).toBe(0);
        expect(await tickOn(1)).toBe(2500);
        expect(await tickOn(2)).toBe(3000);
        // A missed day starts over
        expect(await tickOn(4)).toBe(2000);
    });

    it('tops out at $50 on the seventh day in a row', () => {
        expect([1, 2, 7, 8, 30].map(MoneyFarmerPlugin.allowanceFor)).toEqual([2000, 2500, 5000, 5000, 5000]);
    });

    it('leaves quiet players without an allowance', async () => {
        const quiet = await player('farmsilent', 0);
        quiet.session.lastPublicMessageSentDate = new Date(Date.now() - 6 * 60 * 1000);

        await farmer['tick']();

        expect(quiet.session.user.money).toBe(0);
    });
});
