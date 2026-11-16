import { beforeAll, describe, expect, it, vi } from 'vitest';
import { UserController } from '../../app/server/skychat/UserController.js';
import { settle, TestServer } from './harness.js';

let server: TestServer;

beforeAll(async () => {
    server = await new TestServer().start();
});

describe('connected list', () => {
    // A payout pays every winner at once: the whole list is rebuilt and sent to everyone, so once is enough
    it('rebuilds the list once for money changes made together, and still sends the new balances', async () => {
        const players = await Promise.all([1, 2, 3, 4, 5].map((i) => server.connect(`listpayee${i}`)));
        const watcher = await server.connect('listwatcher');
        await settle(150);
        const plugin = server.roomManager.getPlugin('connectedlist') as unknown as { getConnectedList(): unknown };
        const rebuilds = vi.spyOn(plugin, 'getConnectedList');
        watcher.clear();

        await Promise.all(players.map((p) => UserController.giveMoney(p.session.user, 500, 'Test win')));
        await settle(150);

        expect(rebuilds).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(watcher.events('connected-list-patch'))).toContain('500');
        vi.restoreAllMocks();
    });
});
