import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SkyChatClient } from '../../app/api/SkyChatClient.js';
import { MessageSeenPlugin } from '../../app/server/plugins/core/room/MessageSeenPlugin.js';
import { UserController } from '../../app/server/skychat/UserController.js';
import { TestServer } from './harness.js';

let server: TestServer;

beforeAll(async () => {
    server = await new TestServer().start();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('read receipts', () => {
    // Every viewer acknowledges every message: writing the whole user row each time cost one DB write per viewer per message
    it('keep the last seen message in memory at once, and write it to the database later in one go', async () => {
        const alice = await server.connect('seenalice');
        const room = alice.connection.room!;
        for (let i = 0; i < 5; i++) {
            await alice.send(`hello ${i}`);
        }
        const ids = room.messages.slice(-5).map((m) => m.id);
        const writes = vi.spyOn(UserController, 'sync');
        const saves = vi.spyOn(UserController, 'savePluginData');

        for (const id of ids) {
            await alice.send(`/lastseen ${id}`);
        }

        expect(alice.session.user.data.plugins.lastseen[room.id]).toBe(ids.at(-1));
        expect(writes.mock.calls.length + saves.mock.calls.length).toBe(0);
        await MessageSeenPlugin.flush();
        expect(writes).toHaveBeenCalledTimes(1);
    });

    it('send one acknowledgement for a burst of messages, the latest per room', () => {
        vi.useFakeTimers();
        const client = new SkyChatClient('ws://unused');
        const sent = vi.spyOn(client, 'sendMessage').mockImplementation(() => {});

        for (let id = 1; id <= 10; id++) {
            client.notifySeenMessage(id, 1);
        }
        client.notifySeenMessage(3, 2);
        expect(sent).not.toHaveBeenCalled();
        vi.advanceTimersByTime(SkyChatClient.SEEN_BATCH_MS);

        expect(sent.mock.calls.map(([message]) => message).sort()).toEqual(['/lastseen 10 1', '/lastseen 3 2']);
    });
});
