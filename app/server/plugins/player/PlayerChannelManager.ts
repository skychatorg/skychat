import { EventEmitter } from 'events';
import { Connection } from '../../skychat/Connection.js';
import { Session } from '../../skychat/Session.js';
import { PARTY_GAMES } from '../../../api/party.js';
import { CasinoOptions } from './casino/BlackjackTable.js';
import { logFailure } from '../../skychat/Logging.js';
import { ChannelKind, PlayerChannel, SanitizedPlayerChannel } from './PlayerChannel.js';
import { PlayerPlugin } from './PlayerPlugin.js';

export class PlayerChannelManager extends EventEmitter {
    public readonly channels: PlayerChannel[] = [];

    public readonly plugin: PlayerPlugin;

    /**
     * The channels each session is in: one of each kind, so music keeps playing while you play a game
     */
    public readonly sessionChannels: Map<Session, Partial<Record<ChannelKind, number>>> = new Map();

    constructor(plugin: PlayerPlugin) {
        super();

        this.plugin = plugin;
        this.on('channels-changed', () => this.sync());
    }

    /**
     * Highest id ever given out, saved with the channels so a deleted channel's id is never reused
     */
    public lastChannelId = 0;

    /**
     * Users rejoin their last channel by id, so a reused id would drop them into an unrelated channel
     */
    public getNextChannelId(): number {
        this.lastChannelId = Math.max(this.lastChannelId, ...this.channels.map((channel) => channel.id)) + 1;
        return this.lastChannelId;
    }

    /**
     * Create a new channel with the given name
     */
    public createChannel(id: number, name: string, kind: ChannelKind = 'media', casino?: Partial<CasinoOptions>): PlayerChannel {
        if (this.getChannelById(id)) {
            throw new Error(`Unable to create existing channel ${id}`);
        }

        const channel = new PlayerChannel(this, id, name, kind, casino);
        this.channels.push(channel);
        this.emit('channels-changed', this.channels);
        return channel;
    }

    /**
     * Rename a given channel
     * @param id
     * @param name
     */
    public renameChannel(id: number, name: string) {
        const channel = this.getChannelById(id);
        if (!channel) {
            throw new Error(`Unable to rename non-existant channel ${id}`);
        }

        channel.name = name;
        this.emit('channels-changed', this.channels);
    }

    /**
     * Put the channels in the given order. Channels missing from the list keep their place at the end.
     */
    public reorderChannels(ids: number[]) {
        const rank = (channel: PlayerChannel) => (ids.includes(channel.id) ? ids.indexOf(channel.id) : ids.length);
        this.channels.sort((a, b) => rank(a) - rank(b));
        this.emit('channels-changed', this.channels);
    }

    /**
     * Delete a given channel id
     * @param id
     */
    public deleteChannel(id: number) {
        const channel = this.getChannelById(id);
        if (!channel) {
            throw new Error(`Unable to delete non-existant channel ${id}`);
        }

        // Remove all sessions from this channel, and only this one. A copy: leaving removes the session from this very list
        for (const session of [...channel.sessions]) {
            this.leaveChannel(session, channel.kind);
        }

        channel.destroy();
        this.channels.splice(this.channels.indexOf(channel), 1);
        this.emit('channels-changed', this.channels);
    }

    /**
     * The session's channel of that kind, if any. Without a kind: its game channel, else its media channel
     */
    public getSessionChannel(session: Session, kind?: ChannelKind): PlayerChannel | null {
        const joined = this.sessionChannels.get(session) ?? {};
        const channelId = kind ? joined[kind] : joined.party ?? joined.media;
        return typeof channelId === 'number' ? this.getChannelById(channelId) : null;
    }

    /**
     * The session's media channel, for commands that only make sense with media
     */
    public getSessionMediaChannel(session: Session): PlayerChannel {
        const channel = this.getSessionChannel(session, 'media');
        if (!channel) {
            throw new Error(
                this.getSessionChannel(session, 'party') ? 'This channel is for games, it has no media' : 'Join a media channel first',
            );
        }
        return channel;
    }

    /**
     * Tell the session's tabs which channels it is in
     */
    public sendMemberships(session: Session | Connection) {
        const owner = session instanceof Session ? session : session.session;
        const joined = this.sessionChannels.get(owner) ?? {};
        session.send('player-memberships', { media: joined.media ?? null, party: joined.party ?? null });
    }

    /**
     *
     * @param session
     * @param id
     */
    public joinChannel(session: Session, id: number) {
        // Check that the given channel exists
        const channel = this.getChannelById(id);
        if (!channel) {
            throw new Error(`Channel ${id} not found`);
        }

        // Only the channel of the same kind is left: music keeps playing when you join a game
        const previousChannel = this.getSessionChannel(session, channel.kind);
        if (previousChannel?.id === id) {
            return;
        }
        if (previousChannel) {
            this.leaveChannel(session, channel.kind);
        }

        // Update mappings and session list
        this.sessionChannels.set(session, { ...this.sessionChannels.get(session), [channel.kind]: channel.id });
        channel.sessions.push(session);
        channel.syncConnections(session.connections);

        // Notify all connections of this session that the channel changed
        this.sendMemberships(session);

        // Rebroadcast the channel list so everyone's watcher count/avatars update
        this.sync();
    }

    /**
     * Leave the session's channel of that kind, or both without a kind
     */
    public leaveChannel(session: Session, kind?: ChannelKind) {
        const joined = { ...this.sessionChannels.get(session) };
        const kinds = kind ? [kind] : (Object.keys(joined) as ChannelKind[]);
        if (!kinds.some((k) => typeof joined[k] === 'number')) {
            return;
        }

        for (const k of kinds) {
            const channelId = joined[k];
            if (typeof channelId !== 'number') {
                continue;
            }
            delete joined[k];
            const channel = this.getChannelById(channelId);
            if (channel?.sessions.includes(session)) {
                channel.sessions.splice(channel.sessions.indexOf(session), 1);
                if (channel.party) {
                    logFailure(channel.party.onSessionLeft(session), 'Player channels');
                }
            }
            // Clear only this kind's state on the client: the other channel keeps playing
            if (k === 'media') {
                session.send('player-sync', { current: null, queue: [], cursor: 0, paused: false });
            } else {
                session.send('party', null);
                for (const { event } of Object.values(PARTY_GAMES)) {
                    session.send(event, null);
                }
            }
        }
        if (Object.keys(joined).length) {
            this.sessionChannels.set(session, joined);
        } else {
            this.sessionChannels.delete(session);
        }

        // Notify all connections of this session that the channel changed
        this.sendMemberships(session);

        // Rebroadcast the channel list so everyone's watcher count/avatars update
        this.sync();
    }

    /**
     * To be called when the list of channel or channel metadata changes
     */
    public sync(sessionsOrConnections?: (Session | Connection)[]) {
        if (sessionsOrConnections) {
            const sanitized = this.sanitized();
            for (const sessionOrConnection of sessionsOrConnections) {
                sessionOrConnection.send('player-channels', sanitized);
            }
        } else {
            Session.send('player-channels', this.sanitized());
        }
    }

    /**
     * Find an existing channel by its id
     * @param id
     */
    public getChannelById(id: number): PlayerChannel | null {
        return this.channels.find((channel) => channel.id === id) || null;
    }

    /**
     * What will be sent to the client
     */
    public sanitized(): SanitizedPlayerChannel[] {
        return this.channels.map((channel) => channel.sanitized());
    }

    public toString(): string {
        return (
            PlayerChannelManager.name +
            ' (\n' +
            this.channels
                .map(
                    (channel) =>
                        `  #${channel.id}: [${channel.sessions
                            .map((session) => session.identifier + '(' + session.connections.length + ')')
                            .join(', ')}] [${channel.currentVideoInfo ? channel.currentVideoInfo.video.id : ''}] [${channel.queue.length}]`,
                )
                .join('\n') +
            '\n)'
        );
    }
}
