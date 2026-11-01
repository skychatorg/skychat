import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PrivateMessagePlugin } from '../../app/server/plugins/core/global/PrivateMessagePlugin.js';
import { Room } from '../../app/server/skychat/Room.js';
import { RoomController } from '../../app/server/skychat/RoomController.js';
import { TestServer } from './harness.js';

let server: TestServer;
let n = 0;

// Usernames are global (sessions are static), so each test gets its own
const name = (prefix: string) => `${prefix}${++n}`;

beforeAll(async () => {
    server = await new TestServer().start();
});

const privateRoomsOf = (identifier: string) => server.roomManager.rooms.filter((r) => r.isPrivate && r.whitelist.includes(identifier));

describe('/pm', () => {
    it('creates a private room and moves the sender into it (6177abc)', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));

        await alice.send(`/pm ${bob.session.user.username}`);

        expect(alice.errors()).toEqual([]);
        const room = alice.connection.room!;
        expect(room.isPrivate).toBe(true);
        expect([...room.whitelist].sort()).toEqual([alice.session.identifier, bob.session.identifier].sort());
        expect(bob.last('room-list').map((r: { id: number }) => r.id)).toContain(room.id);
    });

    it('reuses the existing room instead of creating a second one', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));

        await alice.send(`/pm ${bob.session.user.username}`);
        const first = alice.connection.room!;
        await bob.send(`/pm ${alice.session.user.username}`);

        expect(bob.connection.room).toBe(first);
        expect(privateRoomsOf(alice.session.identifier)).toHaveLength(1);
    });

    it('finds a room whose whitelist is no longer sorted after /pmadd (00e85b5)', async () => {
        const alice = await server.connect(name('alice'));
        const zed = await server.connect(name('zed'));
        const bob = await server.connect(name('bob'));

        await alice.send(`/pm ${zed.session.user.username}`);
        const room = alice.connection.room!;
        await alice.send(`/pmadd ${bob.session.user.username}`);
        // The whitelist is appended to, so it is now out of order
        expect(room.whitelist).toEqual([alice.session.identifier, zed.session.identifier, bob.session.identifier]);

        await alice.send(`/join ${server.roomManager.rooms[0].id}`);
        await alice.send(`/pm ${zed.session.user.username} ${bob.session.user.username}`);

        expect(alice.errors()).toEqual([]);
        expect(alice.connection.room).toBe(room);
        expect(privateRoomsOf(alice.session.identifier)).toHaveLength(1);
    });

    it('/pmnew always opens a new room (00e85b5)', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));

        await alice.send(`/pm ${bob.session.user.username}`);
        const first = alice.connection.room!;
        await alice.send(`/pmnew ${bob.session.user.username}`);

        expect(alice.errors()).toEqual([]);
        expect(alice.connection.room).not.toBe(first);
        expect(privateRoomsOf(alice.session.identifier)).toHaveLength(2);
    });
});

describe('private room cap (00e85b5)', () => {
    const fill = async (a: string, b: string, count: number) => {
        for (let i = 0; i < count; i++) {
            await server.roomManager.createPrivateRoom([a, b]);
        }
    };

    it('allows the 50th room', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));
        await fill(alice.session.identifier, name('filler'), PrivateMessagePlugin.MAX_PRIVATE_ROOMS_PER_USER - 1);

        await alice.send(`/pm ${bob.session.user.username}`);

        expect(alice.errors()).toEqual([]);
        expect(privateRoomsOf(alice.session.identifier)).toHaveLength(PrivateMessagePlugin.MAX_PRIVATE_ROOMS_PER_USER);
    });

    it('refuses the 51st room, for the sender', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));
        await fill(alice.session.identifier, name('filler'), PrivateMessagePlugin.MAX_PRIVATE_ROOMS_PER_USER);

        await alice.send(`/pm ${bob.session.user.username}`);

        expect(alice.errors()).toEqual([`${alice.session.identifier} is already in 50 private rooms`]);
        expect(privateRoomsOf(alice.session.identifier)).toHaveLength(PrivateMessagePlugin.MAX_PRIVATE_ROOMS_PER_USER);
    });

    it('refuses the 51st room, for the recipient', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));
        await fill(bob.session.identifier, name('filler'), PrivateMessagePlugin.MAX_PRIVATE_ROOMS_PER_USER);

        await alice.send(`/pm ${bob.session.user.username}`);

        expect(alice.errors()).toEqual([`${bob.session.identifier} is already in 50 private rooms`]);
    });

    it('still opens a room that already exists when at the cap', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));
        await alice.send(`/pm ${bob.session.user.username}`);
        await fill(alice.session.identifier, name('filler'), PrivateMessagePlugin.MAX_PRIVATE_ROOMS_PER_USER - 1);
        await alice.send(`/join ${server.roomManager.rooms[0].id}`);

        await alice.send(`/pm ${bob.session.user.username}`);

        expect(alice.errors()).toEqual([]);
        expect(alice.connection.room!.isPrivate).toBe(true);
    });

    it('applies to /pmadd', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));
        const carol = await server.connect(name('carol'));
        await alice.send(`/pm ${bob.session.user.username}`);
        await fill(carol.session.identifier, name('filler'), PrivateMessagePlugin.MAX_PRIVATE_ROOMS_PER_USER);

        await alice.send(`/pmadd ${carol.session.user.username}`);

        expect(alice.errors()).toEqual([`${carol.session.identifier} is already in 50 private rooms`]);
        expect(alice.connection.room!.whitelist).not.toContain(carol.session.identifier);
    });
});

describe('/pmremove and /pmleave (6177abc)', () => {
    it('/pmremove moves the removed user out of the room', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));
        const carol = await server.connect(name('carol'));
        await alice.send(`/pm ${bob.session.user.username} ${carol.session.user.username}`);
        const room = alice.connection.room!;
        await bob.send(`/join ${room.id}`);
        expect(bob.connection.room).toBe(room);

        await alice.send(`/pmremove ${bob.session.user.username}`);

        expect(alice.errors()).toEqual([]);
        expect(room.whitelist).not.toContain(bob.session.identifier);
        expect(bob.connection.room).not.toBe(room);
        expect(bob.connection.room!.isPrivate).toBe(false);
    });

    it('/pmleave takes an explicit room id', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));
        const carol = await server.connect(name('carol'));
        await alice.send(`/pm ${bob.session.user.username} ${carol.session.user.username}`);
        const room = alice.connection.room!;
        await alice.send(`/join ${server.roomManager.rooms[0].id}`);

        await alice.send(`/pmleave ${room.id}`);

        expect(alice.errors()).toEqual([]);
        expect(room.whitelist).not.toContain(alice.session.identifier);
    });

    // BUG: leaving a 2-person room leaves a 1-entry whitelist, which Room.create refuses, so the room
    // (and the remaining member's history) is dropped with an error on the next server start
    it.fails('a 2-person room someone left still loads after a restart', async () => {
        const alice = await server.connect(name('alice'));
        const bob = await server.connect(name('bob'));
        await alice.send(`/pm ${bob.session.user.username}`);
        const room = alice.connection.room!;

        await alice.send('/pmleave');
        expect(alice.errors()).toEqual([]);
        expect(server.roomManager.rooms).toContain(room);

        // What RoomManager.loadFromDB does on boot
        await expect(Room.create(server.roomManager, await roomRowFor(room), room.id)).resolves.toBeDefined();
    });
});

/**
 * The row the room would be saved as
 */
async function roomRowFor(room: Room) {
    const update = vi.spyOn(RoomController, 'update').mockResolvedValue();
    await room.saveToDB();
    const row = update.mock.calls[0][1];
    update.mockRestore();
    return row;
}
