import { beforeAll, describe, expect, it } from 'vitest';
import { TestServer } from './harness.js';

let server: TestServer;

beforeAll(async () => {
    server = await new TestServer().start();
});

describe('ban list', () => {
    it('sends the bans as data, and only as data when the admin panel asks', async () => {
        const mod = await server.connect('banmod1');
        mod.session.setOP(true);
        mod.clear();

        await mod.send('/banlist ui');
        expect(mod.events('message')).toEqual([]);
        expect(mod.last('ban-list')).toEqual([]);

        await mod.send('/ban banned1 SHADOW 600');
        expect(mod.last('ban-list')).toEqual([{ source: 'banned1', match: 'username:banned1', type: 'SHADOW', until: expect.any(Number) }]);
        expect(mod.last('ban-list')[0].until).toBeGreaterThan(Date.now() + 590_000);

        await mod.send('/unban banned1');
        expect(mod.last('ban-list')).toEqual([]);
        // Typed by hand, the list still shows in the chat
        expect(mod.events('message').length).toBeGreaterThan(0);
    });

    it('only takes ban types in capitals, as the client sends them', async () => {
        const mod = await server.connect('banmod2');
        mod.session.setOP(true);
        mod.clear();
        await mod.send('/ban banned2 access 600');
        expect(mod.errors()).toHaveLength(1);
        await mod.send('/ban banned2 ACCESS 600');
        expect(mod.errors()).toHaveLength(1);
        expect(mod.last('ban-list')).toEqual([expect.objectContaining({ source: 'banned2', type: 'ACCESS' })]);
        await mod.send('/unban banned2');
    });

    it('refuses the list to anyone who cannot moderate', async () => {
        const user = await server.connect('banuser1');
        user.clear();
        await user.send('/banlist ui');
        expect(user.events('ban-list')).toEqual([]);
        expect(user.errors()).toHaveLength(1);
    });
});

describe('bunker', () => {
    it('tells an OP whether guests are locked out, and changes it', async () => {
        const op = await server.connect('bunkerop1');
        op.session.setOP(true);
        op.clear();

        await op.send('/bunker status');
        expect(op.events('message')).toEqual([]);
        expect(op.last('bunker')).toBe(false);
        await op.send('/bunker on');
        expect(op.last('bunker')).toBe(true);
        await op.send('/bunker off');
        expect(op.last('bunker')).toBe(false);
    });
});
