import { beforeAll, describe, expect, it } from 'vitest';
import { PlayerChannel } from '../../app/server/plugins/player/PlayerChannel.js';
import { PlayerPlugin } from '../../app/server/plugins/player/PlayerPlugin.js';
import { settle, TestClient, TestServer } from './harness.js';

let server: TestServer;
let n = 0;
const name = (prefix: string) => `${prefix}${++n}`;
const player = () => server.roomManager.getPlugin(PlayerPlugin.commandName) as PlayerPlugin;
const manager = () => player().channelManager;

beforeAll(async () => {
    server = await new TestServer().start();
});

async function create(kind: 'media' | 'party', title: string): Promise<PlayerChannel> {
    const admin = await server.connect(name('op'));
    admin.session.setOP(true);
    await admin.send(
        kind === 'party' ? `/playerchannelmanage create party 1000 10000 ${title}` : `/playerchannelmanage create media ${title}`,
    );
    return manager().channels.at(-1) as PlayerChannel;
}

const memberships = (client: TestClient) => client.last('player-memberships');

describe('a media channel and a game channel at once', () => {
    it('keeps the music when joining a game, and the game when switching music', async () => {
        const [music, radio, game] = [await create('media', 'Music'), await create('media', 'Radio'), await create('party', 'Games')];
        const alice = await server.connect(name('listener'));

        await alice.send(`/playerchannel join ${music.id}`);
        await alice.send(`/playerchannel join ${game.id}`);
        expect(memberships(alice)).toEqual({ media: music.id, party: game.id });

        await alice.send(`/playerchannel join ${radio.id}`);
        expect(memberships(alice)).toEqual({ media: radio.id, party: game.id });
        expect(music.sessions).not.toContain(alice.session);
        expect(game.sessions).toContain(alice.session);
    });

    it('never sends a game channel media sync, which would stop the music', async () => {
        const [music, game] = [await create('media', 'Music'), await create('party', 'Games')];
        const alice = await server.connect(name('listener'));
        await alice.send(`/playerchannel join ${music.id}`);
        alice.clear();

        await alice.send(`/playerchannel join ${game.id}`);
        await alice.send(`/playerchannel leave ${game.id}`);

        expect(alice.events('player-sync')).toEqual([]);
        expect(alice.last('party')).toBeNull();
    });

    it('leaves one channel by id, or both without one', async () => {
        const [music, game] = [await create('media', 'Music'), await create('party', 'Games')];
        const alice = await server.connect(name('listener'));
        await alice.send(`/playerchannel join ${music.id}`);
        await alice.send(`/playerchannel join ${game.id}`);

        await alice.send(`/playerchannel leave ${music.id}`);
        expect(memberships(alice)).toEqual({ media: null, party: game.id });
        // A channel you aren't in changes nothing
        await alice.send(`/playerchannel leave ${music.id}`);
        expect(game.sessions).toContain(alice.session);

        await alice.send(`/playerchannel join ${music.id}`);
        await alice.send('/playerchannel leave');
        expect(memberships(alice)).toEqual({ media: null, party: null });
        expect([music.sessions, game.sessions]).toEqual([[], []]);
    });

    it('keeps the music when the game channel is deleted', async () => {
        const [music, game] = [await create('media', 'Music'), await create('party', 'Doomed')];
        const alice = await server.connect(name('listener'));
        await alice.send(`/playerchannel join ${music.id}`);
        await alice.send(`/playerchannel join ${game.id}`);

        manager().deleteChannel(game.id);

        expect(memberships(alice)).toEqual({ media: music.id, party: null });
        expect(music.sessions).toContain(alice.session);
    });

    it('leaves both when the last tab closes', async () => {
        const [music, game] = [await create('media', 'Music'), await create('party', 'Games')];
        const alice = await server.connect(name('listener'));
        await alice.send(`/playerchannel join ${music.id}`);
        await alice.send(`/playerchannel join ${game.id}`);

        alice.ws.emit('close', 1000, Buffer.from(''));
        await settle();

        expect([music.sessions, game.sessions]).toEqual([[], []]);
    });

    it('puts users back in both channels on their next visit, and reads the older single-channel saves', async () => {
        const [music, game] = [await create('media', 'Music'), await create('party', 'Games')];
        const alice = await server.connect(name('listener'));
        await alice.send(`/playerchannel join ${music.id}`);
        await alice.send(`/playerchannel join ${game.id}`);
        // The channels are left the way a lost connection leaves them, the save stays
        manager().leaveChannel(alice.session);

        await player().onNewConnection(alice.connection);
        expect(memberships(alice)).toEqual({ media: music.id, party: game.id });

        manager().leaveChannel(alice.session);
        await player().saveUserData(alice.session.user, music.id);
        await player().onNewConnection(alice.connection);
        expect(memberships(alice)).toEqual({ media: music.id, party: null });
    });
});
