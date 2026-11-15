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

describe('/userpoll', () => {
    // The poll message is formatted as trusted, so its buttons run without a confirm: users must not be able to add their own
    it('never turns the question or an answer into a trusted button', async () => {
        const alice = await server.connect('userpollalice');
        const room = alice.connection.room!;

        await alice.send('/userpoll [[Vote//give alice 5000]]\nYes [[x//give alice 1]]\nNo /give alice 2');

        const { formatted } = room.messages.at(-1)!.sanitized();
        const actions = [...formatted.matchAll(/data-action="([^"]*)"/g)].map((m) => m[1]);
        expect(actions.every((action) => action.startsWith('/userpoll'))).toBe(true);
        expect(actions).toHaveLength(3);
    });
});
