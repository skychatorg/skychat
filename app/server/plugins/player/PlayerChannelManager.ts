import { EventEmitter } from 'events';
import { Connection } from '../../skychat/Connection.js';
import { Session } from '../../skychat/Session.js';
import { CasinoOptions } from './casino/BlackjackTable.js';
import { ChannelKind, PlayerChannel, SanitizedPlayerChannel } from './PlayerChannel.js';
import { PlayerPlugin } from './PlayerPlugin.js';

export class PlayerChannelManager extends EventEmitter {
    public readonly channels: PlayerChannel[] = [];

    public readonly plugin: PlayerPlugin;

    /**
     * Mapping from session to channel ids
     */
    public readonly sessionChannels: Map<Session, number> = new Map();

    constructor(plugin: PlayerPlugin) {
        super();

        this.plugin = plugin;
        this.on('channels-changed', () => this.sync());
    }

    /**
     * Get the next available channel id
     * @returns
     */
    public getNextChannelId(): number {
        return this.channels.length === 0 ? 1 : Math.max(...this.channels.map((channel) => channel.id)) + 1;
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

        // Remove all sessions from this channel
        for (const session of channel.sessions) {
            this.leaveChannel(session);
        }

        channel.destroy();
        this.channels.splice(this.channels.indexOf(channel), 1);
        this.emit('channels-changed', this.channels);
    }

    /**
     * Get the channel where the session is, if any
     * @param session
     * @returns
     */
    public getSessionChannel(session: Session): PlayerChannel | null {
        const channelId = this.sessionChannels.get(session);
        if (typeof channelId === 'number') {
            return this.getChannelById(channelId) || null;
        }
        return null;
    }

    /**
     * The session's channel, for commands that only make sense with media
     */
    public getSessionMediaChannel(session: Session): PlayerChannel {
        const channel = this.getSessionChannel(session);
        if (!channel) {
            throw new Error('Join a media channel first');
        }
        if (channel.kind !== 'media') {
            throw new Error('This channel is a casino, it has no media');
        }
        return channel;
    }

    /**
     *
     * @param session
     * @param id
     */
    public joinChannel(session: Session, id: number) {
        // Get current/previous channel
        const previousChannel = this.getSessionChannel(session);

        // If trying to join the same channel
        if (previousChannel && previousChannel.id === id) {
            return;
        }

        // If currently in another channel, leave it
        if (previousChannel) {
            this.leaveChannel(session);
        }

        // Check that the given channel exists
        const channel = this.getChannelById(id);
        if (!channel) {
            throw new Error(`Channel ${id} not found`);
        }

        // Update mappings and session list
        this.sessionChannels.set(session, channel.id);
        channel.sessions.push(session);
        channel.syncConnections(session.connections);

        // Notify all connections of this session that the channel changed
        session.send('player-channel', id);

        // Rebroadcast the channel list so everyone's watcher count/avatars update
        this.sync();
    }

    /**
     *
     * @param session
     */
    public leaveChannel(session: Session) {
        // If the session is already within a channel, leave it first
        const channelId = this.sessionChannels.get(session);
        if (typeof channelId !== 'number') {
            return;
        }

        // Update mappings and session list
        const channel = this.getChannelById(channelId);
        this.sessionChannels.delete(session);
        if (channel) {
            // If channel is not deleted
            channel.sessions.splice(channel.sessions.indexOf(session), 1);
            void channel.table?.onSessionLeft(session);
        }
        session.send('player-sync', { current: null, queue: [], cursor: 0, paused: false });
        session.send('casino-table', null);

        // Notify all connections of this session that the channel changed
        session.send('player-channel', null);

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
