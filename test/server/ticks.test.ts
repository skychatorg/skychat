import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Logging } from '../../app/server/skychat/Logging.js';
import { UserController } from '../../app/server/skychat/UserController.js';
import { TestServer } from './harness.js';

let server: TestServer;

beforeAll(async () => {
    // Only the minute ticks are faked: the rest of the server runs on real timers
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    server = await new TestServer().start();
});

afterAll(() => {
    vi.useRealTimers();
});

describe('minute ticks', () => {
    // An unhandled rejection stops the server: one failed DB write in a tick must only be logged
    it('log a failed database write instead of letting it stop the server', async () => {
        const alice = await server.connect('tickalice');
        alice.session.lastPublicMessageSentDate = new Date();
        vi.spyOn(UserController, 'giveXP').mockRejectedValue(new Error('DB down'));
        vi.spyOn(UserController, 'sync').mockRejectedValue(new Error('DB down'));
        const errors = vi.spyOn(Logging, 'error');

        vi.advanceTimersByTime(60 * 1000);
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(errors.mock.calls.map((call) => call.join(' '))).toEqual(expect.arrayContaining([expect.stringContaining('DB down')]));
        vi.restoreAllMocks();
    });
});
