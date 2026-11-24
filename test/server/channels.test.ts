import { beforeAll, describe, expect, it } from 'vitest';
import { SkyChatClient } from '../../app/api/SkyChatClient.js';
import { Roulette } from '../../app/server/plugins/player/party/Roulette.js';
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

describe('playing a game with music on', () => {
    async function both() {
        const [music, game] = [await create('media', 'Music'), await create('party', 'Games')];
        const alice = await server.connect(name('listener'));
        alice.session.user.money = 20000;
        await alice.send(`/playerchannel join ${music.id}`);
        await alice.send(`/playerchannel join ${game.id}`);
        alice.clear();
        return { music, game, alice };
    }

    it('sends game commands to the game and player commands to the music', async () => {
        const { music, game, alice } = await both();
        music.add({ type: 'iframe', id: 'https://example.com/a', duration: 180_000, startCursor: 0, title: 'First' });
        music.add({ type: 'iframe', id: 'https://example.com/b', duration: 180_000, startCursor: 0, title: 'Second' });

        await alice.send('/party pick roulette');
        await alice.send('/player skip');

        expect(alice.errors()).toEqual([]);
        expect(game.party?.gameOf(Roulette)).toBeTruthy();
        expect(music.getPlayerData().current?.video.title).toBe('Second');
    });

    it('keeps sending the music to players of a game', async () => {
        const { music, alice } = await both();

        music.add({ type: 'iframe', id: 'https://example.com/', duration: 180_000, startCursor: 0, title: 'Song' });
        await settle();

        expect(alice.last('player-sync').current.video.title).toBe('Song');
    });

    it('lists users in both channels, and only takes them off the one they leave', async () => {
        const { music, game, alice } = await both();
        const usernames = (channel: PlayerChannel) => channel.sanitized().users.map((user) => user.username);
        expect([usernames(music), usernames(game)]).toEqual([[alice.session.user.username], [alice.session.user.username]]);

        await alice.send(`/playerchannel leave ${game.id}`);

        expect([usernames(music), usernames(game)]).toEqual([[alice.session.user.username], []]);
    });

    it('keeps the bet of a player leaving mid-round on the table, and leaves the music alone', async () => {
        const { music, game, alice } = await both();
        await alice.send('/party pick roulette');
        await alice.send('/party bet 37 1000');
        expect(alice.session.user.money).toBe(19000);

        await alice.send(`/playerchannel leave ${game.id}`);
        await settle();

        // Roulette pays a bet left on the table like any other
        expect(game.party?.gameOf(Roulette)?.['bets'].get(alice.session)).toEqual([{ space: 37, amount: 1000 }]);
        expect(music.sessions).toContain(alice.session);
        expect(alice.events('player-sync')).toEqual([]);
    });
});

describe('which channel the player shows', () => {
    const channels = [
        { id: 1, kind: 'media', name: 'Music' },
        { id: 2, kind: 'media', name: 'Radio' },
        { id: 3, kind: 'party', name: 'Games' },
    ];
    const client = () => {
        const c = new SkyChatClient('ws://unused');
        c.emit('player-channels', channels);
        return c;
    };
    const view = (c: SkyChatClient) => [c.state.currentPlayerChannelId, c.state.sideChannelId];

    it('shows a game when one is joined, and puts music joined during it on the side', () => {
        const c = client();
        c.emit('player-memberships', { media: 1, party: null });
        expect(view(c)).toEqual([1, null]);
        c.emit('player-memberships', { media: 1, party: 3 });
        expect(view(c)).toEqual([3, 1]);
        c.emit('player-memberships', { media: 2, party: 3 });
        expect(view(c)).toEqual([3, 2]);
    });

    it('shows the game when both come back at once after a reload', () => {
        const c = client();
        c.emit('player-memberships', { media: 1, party: 3 });
        expect(view(c)).toEqual([3, 1]);
    });

    it('swaps the two on demand, and keeps a swapped-in music in front when the station changes', () => {
        const c = client();
        c.emit('player-memberships', { media: 1, party: 3 });
        c.swapPlayerChannels();
        expect(view(c)).toEqual([1, 3]);
        c.emit('player-memberships', { media: 2, party: 3 });
        expect(view(c)).toEqual([2, 3]);
    });

    it('brings the other channel back when the shown one is left, and swaps nothing with a single channel', () => {
        const c = client();
        c.emit('player-memberships', { media: 1, party: 3 });
        c.emit('player-memberships', { media: 1, party: null });
        expect(view(c)).toEqual([1, null]);
        c.swapPlayerChannels();
        expect(view(c)).toEqual([1, null]);
        c.emit('player-memberships', { media: null, party: null });
        expect(view(c)).toEqual([null, null]);
    });
});
