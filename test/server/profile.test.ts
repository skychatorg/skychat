import { beforeAll, describe, expect, it } from 'vitest';
import { Session } from '../../app/server/skychat/Session.js';
import { TestServer } from './harness.js';

let server: TestServer;

beforeAll(async () => {
    server = await new TestServer().start();
});

describe('profile changes', () => {
    it('reach the user and everyone else right away', async () => {
        const alice = await server.connect('profilealice', 0);
        const bob = await server.connect('profilebob', 0);
        alice.clear();
        bob.clear();

        await alice.send('/motto living dangerously');

        expect(alice.last('set-user').data.plugins.motto).toBe('living dangerously');
        expect(JSON.stringify(bob.events('connected-list-patch'))).toContain('living dangerously');
    });

    it('shows money a user receives on their own screen right away', async () => {
        const admin = await server.connect('profileadmin', 0);
        admin.session.setOP(true);
        const carol = await server.connect('profilecarol', 0);
        carol.clear();

        await admin.send('/offermoney profilecarol 2500');

        expect(carol.last('set-user').money).toBe(2500);
    });

    it.each([
        ['a purchase', '/wizz profiledan', 'profileeve', 123456 - 1000],
        ['money given to someone else', '/give profilefrank 10000', 'profilefrank', 8000],
    ])('show %s in everyone else’s user list right away', async (_label, command, changed, expected) => {
        const eve = await server.connect('profileeve', 0);
        await server.connect('profiledan', 0);
        await server.connect('profilefrank', 0);
        const watcher = await server.connect('profilewatcher', 0);
        eve.session.user.money = 123456;
        Session.getSessionByIdentifier(changed)!.user.money = changed === 'profilefrank' ? 0 : 123456;
        watcher.clear();

        await eve.send(command);

        expect(eve.errors()).toEqual([]);
        expect(Session.getSessionByIdentifier(changed)!.user.money).toBe(expected);
        expect(JSON.stringify(watcher.events('connected-list-patch'))).toContain(String(expected));
    });
});
