import { describe, expect, it, vi } from 'vitest';
import { serverNow, setServerTime } from '../../app/client/src/lib/serverClock.js';
import { TestServer } from './harness.js';

describe('server clock', () => {
    it('stamps the server time on the ping sent on connect', async () => {
        const server = await new TestServer().start();
        const before = Date.now();
        const alice = await server.connect('Alice');
        expect(alice.events('ping')).toHaveLength(1);
        expect(alice.last('ping')).toBeGreaterThanOrEqual(before);
        expect(alice.last('ping')).toBeLessThanOrEqual(Date.now());
    });

    it('counts on the server time on a client whose clock is off', () => {
        // This machine's clock runs 3 s behind the server's
        const local = 1_000_000;
        vi.spyOn(Date, 'now').mockReturnValue(local);
        setServerTime(local + 3000);
        expect(serverNow()).toBe(local + 3000);
        vi.spyOn(Date, 'now').mockReturnValue(local + 500);
        expect(serverNow()).toBe(local + 3500);
        vi.restoreAllMocks();
    });
});
