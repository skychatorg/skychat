import { beforeAll, describe, expect, it, vi } from 'vitest';
import { settle, TestServer } from './harness.js';

let server: TestServer;
let n = 0;
const name = (prefix: string) => `${prefix}${++n}`;

beforeAll(async () => {
    server = await new TestServer().start();
});

describe('/join (6177abc)', () => {
    it('sends the history of an empty room, so the client leaves its loading state', async () => {
        const alice = await server.connect(name('alice'));
        const room = await server.roomManager.createRoom('Empty');
        alice.clear();

        await alice.send(`/join ${room.id}`);

        expect(alice.connection.room).toBe(room);
        expect(alice.events('messages')).toEqual([[]]);
    });

    it('resyncs the current room and its history when the join is rejected', async () => {
        const alice = await server.connect(name('alice'));
        const current = alice.connection.room!;
        alice.clear();

        await alice.send('/join 99999');

        expect(alice.errors()).toHaveLength(1);
        expect(alice.connection.room).toBe(current);
        expect(alice.last('join-room')).toBe(current.id);
        expect(alice.events('messages')).toHaveLength(1);
    });

    it('rejects a private room the user is not invited to', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));
        const carol = await server.connect(name('carol'));
        await bob.send(`/pm ${carol.session.user.username}`);
        const current = alice.connection.room!;

        await alice.send(`/join ${bob.connection.room!.id}`);

        expect(alice.errors()).toHaveLength(1);
        expect(alice.connection.room).toBe(current);
    });

    it('handles commands from one connection in order, even when the first one is slower', async () => {
        const alice = await server.connect(name('alice'));
        const slow = await server.roomManager.createRoom('Slow');
        const fast = await server.roomManager.createRoom('Fast');
        const attach = slow.attachConnection.bind(slow);
        vi.spyOn(slow, 'attachConnection').mockImplementation(async (connection) => {
            await settle(50);
            await attach(connection);
        });

        alice.connection.emit('message', `/join ${slow.id}`);
        alice.connection.emit('message', `/join ${fast.id}`);
        await settle(150);

        expect(alice.errors()).toEqual([]);
        expect(alice.connection.room).toBe(fast);
    });
});

describe('/lastseen (5ad3a5e)', () => {
    const postIn = async (roomId: number) => {
        const bob = await server.connect(name('bob'));
        await bob.send(`/join ${roomId}`);
        await bob.send('hello');
        return bob.last('message').id as number;
    };

    it('marks a room the user is not in as read, and tells the user', async () => {
        const other = await server.roomManager.createRoom('Other');
        const messageId = await postIn(other.id);
        const alice = await server.connect(name('alice'));
        expect(alice.connection.room).not.toBe(other);

        await alice.send(`/lastseen ${messageId} ${other.id}`);

        expect(alice.errors()).toEqual([]);
        expect(alice.last('message-seen')).toEqual({
            user: alice.session.user.id,
            data: expect.objectContaining({ [other.id]: messageId }),
        });
        expect(alice.session.user.data.plugins.lastseen[other.id]).toBe(messageId);
    });

    it('ignores a private room the user is not invited to', async () => {
        const bob = await server.connect(name('bob'));
        const carol = await server.connect(name('carol'));
        await bob.send(`/pm ${carol.session.user.username}`);
        await bob.send('secret');
        const room = bob.connection.room!;
        const messageId = bob.last('message').id;
        const alice = await server.connect(name('alice'));

        await alice.send(`/lastseen ${messageId} ${room.id}`);

        expect(alice.events('message-seen')).toEqual([]);
        expect(alice.session.user.data.plugins.lastseen[room.id]).toBeUndefined();
    });
});

describe('/pointscollector (71af048)', () => {
    it('starts a round and sends the game objects as JSON cursors', async () => {
        const room = await server.roomManager.createRoom('Game');
        const alice = await server.connect(name('alice'));
        await alice.send(`/join ${room.id}`);

        // The round lasts 30s; a few ticks are enough
        alice.connection.emit('message', '/pointscollector');
        await settle(350);

        expect(alice.errors()).toEqual([]);
        const cursors = alice.events('cursor');
        expect(cursors.length).toBeGreaterThan(0);
        expect(cursors[0].user.username).toMatch(/^\$pointscollector_(ball|point)$/);
    });

    // The round used to run inside the command, and commands from one connection run one at a time (6177abc)
    it('lets the player keep chatting during a round', async () => {
        const room = await server.roomManager.createRoom('Game 2');
        const alice = await server.connect(name('alice'));
        await alice.send(`/join ${room.id}`);
        alice.connection.emit('message', '/pointscollector');
        await settle(150);

        await alice.send('still here');

        expect(alice.events('message').map((m) => m.content)).toContain('still here');
    });

    it('rejects parameters, since it takes none', async () => {
        const room = await server.roomManager.createRoom('Game 4');
        const alice = await server.connect(name('alice'));
        await alice.send(`/join ${room.id}`);

        await alice.send('/pointscollector now');

        expect(alice.errors()).toEqual(['Expected at most 0 parameters. Got 1']);
    });

    it('does not use up the cooldown on a typo', async () => {
        const room = await server.roomManager.createRoom('Game 5');
        const alice = await server.connect(name('alice'));
        await alice.send(`/join ${room.id}`);

        await alice.send('/pointscollector now');
        expect(alice.errors()).toEqual(['Expected at most 0 parameters. Got 1']);
        alice.clear();
        alice.connection.emit('message', '/pointscollector');
        await settle(150);

        expect(alice.errors()).toEqual([]);
        expect(alice.events('cursor').length).toBeGreaterThan(0);
    });

    it('does not use up the cooldown when a round is already running', async () => {
        const room = await server.roomManager.createRoom('Game 3');
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));
        await alice.send(`/join ${room.id}`);
        await bob.send(`/join ${room.id}`);
        alice.connection.emit('message', '/pointscollector');
        await settle(150);

        await bob.send('/pointscollector');
        expect(bob.errors()).toEqual(['A round is already in progress']);
        bob.clear();
        await bob.send('/pointscollector');

        expect(bob.errors()).toEqual(['A round is already in progress']);
    });
});
