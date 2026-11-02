import { beforeAll, describe, expect, it } from 'vitest';
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
});
