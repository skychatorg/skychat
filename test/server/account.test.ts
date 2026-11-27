import { beforeAll, describe, expect, it } from 'vitest';
import { UserController } from '../../app/server/skychat/UserController.js';
import { TestServer } from './harness.js';

let server: TestServer;
let n = 0;

beforeAll(async () => {
    server = await new TestServer().start();
});

/** A logged-in user whose password is `secret` */
async function withPassword() {
    const client = await server.connect(`account${++n}`);
    const { user } = client.session;
    user.setHashedPassword(UserController.hashPassword(user.id, user.username.toLowerCase(), 'secret'));
    return client;
}

describe('/set password', () => {
    it('refuses a missing new password, and keeps the old one', async () => {
        const alice = await withPassword();

        await alice.send('/set password secret');

        expect(alice.errors()).toEqual(['Give your current password, then the new one']);
        expect(
            alice.session.user.testHashedPassword(
                UserController.hashPassword(alice.session.user.id, alice.session.user.username.toLowerCase(), 'secret'),
            ),
        ).toBe(true);
    });

    it('changes the password when the current one is right', async () => {
        const alice = await withPassword();

        await alice.send('/set password secret better');

        expect(alice.errors()).toEqual([]);
        const { id, username } = alice.session.user;
        expect(alice.session.user.testHashedPassword(UserController.hashPassword(id, username.toLowerCase(), 'better'))).toBe(true);
    });

    it('refuses a wrong current password', async () => {
        const alice = await withPassword();

        await alice.send('/set password wrong better');

        expect(alice.errors()).toEqual(['Invalid current password']);
    });
});
