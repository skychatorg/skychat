import { beforeAll, describe, expect, it } from 'vitest';
import { settle, TestServer } from './harness.js';

let server: TestServer;

beforeAll(async () => {
    server = await new TestServer().start();
});

describe('/poll', () => {
    // The poll used to run inside the command, and commands from one connection run one at a time (6177abc)
    it('lets the creator vote and chat while the poll is open', async () => {
        const alice = await server.connect('pollalice');
        const room = alice.connection.room!;
        alice.connection.emit('message', '/poll Pizza tonight?');
        await settle(100);
        const pollId = alice.last('poll').id;

        await alice.send(`/vote ${pollId} y`);
        await alice.send('still here');

        expect(alice.errors()).toEqual([]);
        expect(alice.last('poll')).toMatchObject({ id: pollId, yesCount: 1 });
        expect(room.messages.map((m) => m.content)).toContain('still here');
    });
});
