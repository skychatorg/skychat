import { describe, expect, it } from 'vitest';
import { TestServer } from './harness.js';

describe('harness', () => {
    it('connects a user to the main room', async () => {
        const server = await new TestServer().start();
        const alice = await server.connect('Alice');
        expect(alice.connection.room?.id).toBe(server.roomManager.rooms[0].id);
        await alice.send('hello');
        expect(alice.errors()).toEqual([]);
        expect(alice.events('message').map((m) => m.content)).toContain('hello');
    });
});
