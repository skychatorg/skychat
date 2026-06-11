import { EventEmitter } from 'events';
import { Connection } from '../../skychat/Connection.js';
import { Session } from '../../skychat/Session.js';
import { VoiceError } from './VoiceError.js';
import { VoiceChannel } from './VoiceChannel.js';
import type { VoicePlugin } from './VoicePlugin.js';

/**
 * Owns the channel list and the session -> channelId map. Mirrors PlayerChannelManager.
 * Emits 'channels-changed'; sync() broadcasts a per-viewer 'voice-channels' roster.
 */
export class VoiceChannelManager extends EventEmitter {
    public readonly channels: VoiceChannel[] = [];
    public readonly plugin: VoicePlugin;
    public readonly sessionChannels: Map<Session, number> = new Map();

    constructor(plugin: VoicePlugin) {
        super();
        this.plugin = plugin;
        this.on('channels-changed', () => this.sync());
    }

    public getNextChannelId(): number {
        return this.channels.length === 0 ? 1 : Math.max(...this.channels.map((c) => c.id)) + 1;
    }

    public createChannel(id: number, name: string): VoiceChannel {
        if (this.getChannelById(id)) {
            throw new VoiceError(`Unable to create existing channel ${id}`);
        }
        const channel = new VoiceChannel(this, id, name);
        this.channels.push(channel);
        this.emit('channels-changed', this.channels);
        return channel;
    }

    public renameChannel(id: number, name: string) {
        const channel = this.getChannelById(id);
        if (!channel) {
            throw new VoiceError(`Unable to rename non-existant channel ${id}`);
        }
        channel.name = name;
        this.emit('channels-changed', this.channels);
    }

    public deleteChannel(id: number) {
        const channel = this.getChannelById(id);
        if (!channel) {
            throw new VoiceError(`Unable to delete non-existant channel ${id}`);
        }
        // Evict every session (closes transports via leaveChannel -> closeConnection).
        for (const session of [...channel.sessions]) {
            this.leaveChannel(session);
        }
        this.channels.splice(this.channels.indexOf(channel), 1);
        this.emit('channels-changed', this.channels);
    }

    public getSessionChannel(session: Session): VoiceChannel | null {
        const id = this.sessionChannels.get(session);
        return typeof id === 'number' ? this.getChannelById(id) : null;
    }

    public getChannelById(id: number): VoiceChannel | null {
        return this.channels.find((c) => c.id === id) || null;
    }

    /** Join. Gating already done by VoicePlugin BEFORE calling this. */
    public async joinChannel(session: Session, id: number) {
        const previous = this.getSessionChannel(session);
        if (previous && previous.id === id) {
            return;
        }
        if (previous) {
            this.leaveChannel(session);
        }
        const channel = this.getChannelById(id);
        if (!channel) {
            throw new VoiceError(`Channel ${id} not found`);
        }
        await channel.ensureRouter();
        this.sessionChannels.set(session, channel.id);
        channel.addSession(session);

        // Tell this session it is now in channel `id`, and hand it the router caps.
        session.send('voice-channel', id);
        session.send('voice-router-caps', { channelId: id, rtpCapabilities: channel.getRouterRtpCapabilities() });

        this.emit('channels-changed', this.channels); // roster changed
    }

    public leaveChannel(session: Session) {
        const id = this.sessionChannels.get(session);
        if (typeof id !== 'number') {
            return;
        }
        const channel = this.getChannelById(id);
        this.sessionChannels.delete(session);
        if (channel) {
            for (const connection of session.connections) {
                channel.closeConnection(connection);
            }
            channel.removeSession(session);
        }
        session.send('voice-channel', null);
        this.emit('channels-changed', this.channels);
    }

    private sendRosterTo(target: Session | Connection) {
        const viewer = target instanceof Connection ? target.session : target;
        const roster = this.channels.map((c) => c.sanitizedFor(viewer));
        target.send('voice-channels', roster);
    }

    /** Broadcast the per-viewer channel list (+ rosters). */
    public sync(targets?: (Session | Connection)[]) {
        if (targets) {
            for (const t of targets) {
                this.sendRosterTo(t);
            }
        } else {
            for (const session of Object.values(Session.sessions)) {
                this.sendRosterTo(session);
            }
        }
    }

    /** Re-evaluate every channel's live policy (called from moderation toggles). */
    public revalidateAll() {
        for (const channel of [...this.channels]) {
            channel.revalidate();
        }
        this.sync();
    }
}
