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

        await farmer['tick']();

        expect(players.map((p) => p.session.user.money)).toEqual([515, 2005, 20000]);
        expect(quiet.session.user.money).toBe(500);
    });

    it('gives a broke player $10 once a day, then the usual pay', async () => {
        const broke = await player('farmbroke', 40);

        await farmer['tick']();
        expect(broke.session.user.money).toBe(1040);
        expect(broke.last('info')).toContain('$10');

        broke.session.user.money = 0;
        await farmer['tick']();
        expect(broke.session.user.money).toBe(15);

        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + MoneyFarmerPlugin.BAILOUT.everyMs);
        await farmer['tick']();
        expect(broke.session.user.money).toBe(1015);
    });
});
