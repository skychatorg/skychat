import { beforeAll, describe, expect, it } from 'vitest';
import { PlayerChannel } from '../../app/server/plugins/player/PlayerChannel.js';
import { PlayerPlugin } from '../../app/server/plugins/player/PlayerPlugin.js';
import { TestServer } from './harness.js';

let server: TestServer;
const player = () => server.roomManager.getPlugin(PlayerPlugin.commandName) as PlayerPlugin;

beforeAll(async () => {
    server = await new TestServer().start();
});

/**
 * A media channel playing a 3 minute track, `at` ms in
 */
async function playing(at: number) {
    const admin = await server.connect(`op${Date.now()}`);
    admin.session.setOP(true);
    await admin.send('/playerchannelmanage create media Listening');
    const channel = player().channelManager.channels.at(-1) as PlayerChannel;
    channel.add({ type: 'iframe', id: 'https://example.com/', duration: 180_000, startCursor: 0, title: 'Track' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    channel.seek(at);
    return channel;
}

describe('moving the cursor', () => {
    it('stops at the start when going back 30s near it', async () => {
        const channel = await playing(10_000);
        channel.moveCursor(-30_000);
        expect(channel.getCursor()).toBeGreaterThanOrEqual(0);
        expect(channel.getCursor()).toBeLessThan(1_000);
    });

    it('stops at the end when skipping 30s near it', async () => {
        const channel = await playing(170_000);
        channel.moveCursor(30_000);
        expect(channel.getCursor()).toBeLessThanOrEqual(180_000 + 50);
    });
});
