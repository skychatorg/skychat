import type { DtlsParameters, MediaKind, RtpCapabilities, RtpParameters } from 'mediasoup/node/lib/types.js';
import { Config } from '../../skychat/Config.js';
import { Connection } from '../../skychat/Connection.js';
import { Logging } from '../../skychat/Logging.js';
import { RoomManager } from '../../skychat/RoomManager.js';
import { Session } from '../../skychat/Session.js';
import { User } from '../../skychat/User.js';
import { GlobalPlugin } from '../GlobalPlugin.js';
import { BanPlugin } from '../core/global/BanPlugin.js';
import { BlacklistPlugin } from '../core/global/BlacklistPlugin.js';
import { BunkerPlugin } from '../security_extra/BunkerPlugin.js';
import { VoiceChannelManager } from './VoiceChannelManager.js';
import { VoiceError } from './VoiceError.js';
import { VoiceSfu } from './VoiceSfu.js';
import { issueVoiceDtlsId } from './VoiceToken.js';

/** Ban types from BanPlugin (verified: ACCESS=0, SHADOW=1). */
const BAN_ACCESS = 0;
const BAN_SHADOW = 1;

/**
 * One GlobalPlugin owning the in-process mediasoup SFU. Mirrors PlayerPlugin.
 * Hosts the /voice* signaling commands, the rights gates, the moderation lookups,
 * and the single eviction path (onConnectionClosed).
 */
export class VoicePlugin extends GlobalPlugin {
    static readonly commandName = 'voice';

    static readonly commandAliases = [
        'voicechannelmanage',
        'voicechannel',
        'voicertpcaps',
        'voicetransport',
        'voiceconnect',
        'voiceproduce',
        'voiceconsume',
        'voicemute',
        'voicekick',
    ];

    static readonly defaultDataStorageValue: { channel: null | number } = { channel: null };

    readonly rules = {
        voicechannelmanage: {
            minCount: 1,
            maxCallsPer10Seconds: 14,
            params: [
                { name: 'action', pattern: /^(create|delete|rename)$/ },
                { name: 'param', pattern: /./ },
            ],
        },
        voicechannel: {
            minCount: 1,
            maxCount: 2,
            maxCallsPer10Seconds: 14,
            params: [
                { name: 'action', pattern: /^(join|leave)$/ },
                { name: 'id', pattern: /^([0-9]+)$/ },
            ],
        },
        voicertpcaps: { minCount: 1, maxCallsPer10Seconds: 5, params: [{ name: 'json', pattern: /./ }] },
        voicetransport: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{ name: 'direction', pattern: /^(send|recv)$/ }],
        },
        voiceconnect: {
            minCount: 2,
            maxCount: 3,
            maxCallsPer10Seconds: 10,
            params: [
                { name: 'direction', pattern: /^(send|recv)$/ },
                { name: 'json', pattern: /./ },
            ],
        },
        voiceproduce: { minCount: 1, maxCount: 1, maxCallsPer10Seconds: 5, params: [{ name: 'json', pattern: /./ }] },
        voiceconsume: { minCount: 1, maxCount: 1, maxCallsPer10Seconds: 60, params: [{ name: 'producerId', pattern: /^[a-z0-9-]+$/i }] },
        voicemute: { minCount: 1, maxCount: 1, params: [{ name: 'username', pattern: User.USERNAME_REGEXP }] },
        voicekick: { minCount: 1, maxCount: 1, params: [{ name: 'username', pattern: User.USERNAME_REGEXP }] },
    };

    protected storage: { channels: { id: number; name: string }[]; voiceMuted: string[] } = { channels: [], voiceMuted: [] };

    public readonly sfu: VoiceSfu;
    public readonly channelManager: VoiceChannelManager;

    constructor(manager: RoomManager) {
        super(manager);

        this.loadStorage();
        // Backfill fields if storage predates them.
        this.storage.channels = this.storage.channels ?? [];
        this.storage.voiceMuted = this.storage.voiceMuted ?? [];

        this.sfu = new VoiceSfu();
        this.channelManager = new VoiceChannelManager(this);

        // Recreate channel definitions from storage (names/ids only — no media state to restore).
        for (const c of this.storage.channels) {
            this.channelManager.createChannel(c.id, c.name);
        }

        // Persist channel definitions on change.
        this.channelManager.on('channels-changed', () => {
            this.storage.channels = this.channelManager.channels.map((c) => ({ id: c.id, name: c.name }));
            this.syncStorage();
        });

        // Boot the SFU. createWorker is async; do it once, log on error.
        this.sfu.init().catch((err) => {
            Logging.error('VoiceSfu init failed', err);
        });
    }

    // ---- rights helpers (mirror PlayerPlugin.canAddMedia) ----

    private rightFor(pref: number | 'op', session: Session): boolean {
        const expected = pref === 'op' ? Infinity : pref;
        const actual = session.isOP() ? Infinity : session.user.right;
        return actual >= expected;
    }

    public canJoinVoice(session: Session): boolean {
        return this.rightFor(Config.PREFERENCES.minRightForVoiceJoin, session);
    }

    public canSpeakVoice(session: Session): boolean {
        return this.rightFor(Config.PREFERENCES.minRightForVoiceSpeak, session);
    }

    public canModerateVoice(session: Session): boolean {
        return this.rightFor(Config.PREFERENCES.minRightForVoiceModeration, session);
    }

    // ---- moderation lookups (the only place that reaches into other plugins) ----

    private getBan(): BanPlugin | null {
        return (this.manager.getPlugin('ban') as BanPlugin | null) ?? null;
    }

    /** Access ban (gate join; the WS close is the real eviction). */
    public isAccessBanned(connection: Connection): boolean {
        return !!this.getBan()?.isBanned(connection, BAN_ACCESS);
    }

    public isShadowBanned(connection: Connection): boolean {
        return !!this.getBan()?.isBanned(connection, BAN_SHADOW);
    }

    public isSessionShadowBanned(session: Session): boolean {
        return session.connections.some((c) => this.isShadowBanned(c));
    }

    /** Inverted per-pair blacklist: block if EITHER side blocked the other (covers "blacklist all guests"). */
    public isPairBlocked(a: Session, b: Session): boolean {
        return BlacklistPlugin.isBlockedBy(a.user, b.user) || BlacklistPlugin.isBlockedBy(b.user, a.user);
    }

    /** Bunker on + guest => producer suppressed. */
    public isBunkerGuestBlocked(session: Session): boolean {
        if (!session.user.isGuest()) {
            return false;
        }
        const bunker = this.manager.getPlugin('bunker') as BunkerPlugin | null;
        return !!bunker?.isOn();
    }

    public isVoiceMuted(session: Session): boolean {
        return this.storage.voiceMuted.includes(session.identifier);
    }

    private setVoiceMuted(session: Session, muted: boolean) {
        const i = this.storage.voiceMuted.indexOf(session.identifier);
        if (muted && i === -1) {
            this.storage.voiceMuted.push(session.identifier);
        } else if (!muted && i !== -1) {
            this.storage.voiceMuted.splice(i, 1);
        }
        this.syncStorage();
    }

    /** Public entry point for live policy re-evaluation, called from other plugins' toggles. */
    public revalidateVoice() {
        this.channelManager.revalidateAll();
    }

    // ---- dispatcher with error boundary ----

    public async run(alias: string, param: string, connection: Connection): Promise<void> {
        try {
            switch (alias) {
                case 'voicechannelmanage':
                    return await this.handleChannelManage(param, connection);
                case 'voicechannel':
                    return await this.handleChannel(param, connection);
                case 'voicertpcaps':
                    return await this.handleRtpCaps(param, connection);
                case 'voicetransport':
                    return await this.handleTransport(param, connection);
                case 'voiceconnect':
                    return await this.handleConnect(param, connection);
                case 'voiceproduce':
                    return await this.handleProduce(param, connection);
                case 'voiceconsume':
                    return await this.handleConsume(param, connection);
                case 'voicemute':
                    return await this.handleVoiceMute(param, connection);
                case 'voicekick':
                    return await this.handleVoiceKick(param, connection);
                default:
                    throw new VoiceError('Unsupported action');
            }
        } catch (error) {
            if (error instanceof VoiceError) {
                throw error; // known-safe static message
            }
            // Raw library/mediasoup error: log the real one, send a generic one.
            Logging.error('Voice handler error', error);
            throw new Error('Voice error');
        }
    }

    private parseJson<T>(raw: string): T {
        try {
            return JSON.parse(raw) as T;
        } catch {
            throw new VoiceError('Invalid JSON payload');
        }
    }

    private requireChannel(connection: Connection) {
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (!channel) {
            throw new VoiceError('Not in a voice channel');
        }
        return channel;
    }

    // ---- handlers ----

    private async handleChannelManage(param: string, connection: Connection) {
        if (!connection.session.isOP()) {
            throw new VoiceError('Command only for OP');
        }
        const action = param.split(' ')[0];
        const value = param.substr(action.length + 1).trim();
        if (action === 'create') {
            const id = this.channelManager.getNextChannelId();
            this.channelManager.createChannel(id, value || `Voice ${id}`);
            return;
        }
        if (action === 'delete') {
            const channel = this.channelManager.getSessionChannel(connection.session);
            if (!channel) {
                throw new VoiceError('Not in a channel');
            }
            this.channelManager.deleteChannel(channel.id);
            return;
        }
        if (action === 'rename') {
            const channel = this.channelManager.getSessionChannel(connection.session);
            if (!channel) {
                throw new VoiceError('Not in a channel');
            }
            this.channelManager.renameChannel(channel.id, value);
            return;
        }
        throw new VoiceError('Unsupported action');
    }

    private async handleChannel(param: string, connection: Connection) {
        const action = param.split(' ')[0];
        const value = param.substr(action.length + 1).trim();
        const session = connection.session;

        if (action === 'leave') {
            this.channelManager.leaveChannel(session);
            if (session.user.id > 0) {
                this.saveUserData(session.user, { channel: null });
            }
            return;
        }

        if (action === 'join') {
            const id = parseInt(value, 10);
            // All gating in JS, before any transport.
            if (!this.canJoinVoice(session)) {
                throw new VoiceError('You do not have permission to join voice');
            }
            if (this.isAccessBanned(connection)) {
                throw new VoiceError('You are banned');
            }
            const room = connection.room;
            if (!room || !room.accepts(session)) {
                throw new VoiceError('You cannot join voice in this room');
            }
            await this.channelManager.joinChannel(session, id);
            if (session.user.id > 0) {
                this.saveUserData(session.user, { channel: id });
            }
            return;
        }

        throw new VoiceError('Unsupported action');
    }

    private async handleRtpCaps(param: string, connection: Connection) {
        const channel = this.requireChannel(connection);
        const { rtpCapabilities } = this.parseJson<{ rtpCapabilities: RtpCapabilities }>(param);
        channel.setRtpCapabilities(connection, rtpCapabilities);
        connection.send('voice-rtpcaps-ok', { ok: true });
    }

    private async handleTransport(param: string, connection: Connection) {
        const channel = this.requireChannel(connection);
        const direction = param.trim();
        if (direction !== 'send' && direction !== 'recv') {
            throw new VoiceError('Invalid direction');
        }
        // A send transport implies the intent to speak: gate it now.
        if (direction === 'send' && !this.canSpeakVoice(connection.session)) {
            throw new VoiceError('You do not have permission to speak (listener only)');
        }

        const transport = await channel.createTransport(connection, direction);
        const dtlsId = issueVoiceDtlsId({
            sessionId: connection.session.identifier,
            transportId: transport.id,
            channelId: channel.id,
            exp: Date.now() + 2 * 60 * 1000,
        });

        // SERVER candidates ONLY. No client IP, no SDP.
        connection.send('voice-transport', {
            direction,
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            dtlsId,
        });
    }

    private async handleConnect(param: string, connection: Connection) {
        const channel = this.requireChannel(connection);
        const parts = param.split(' ');
        const direction = parts[0];
        if (direction !== 'send' && direction !== 'recv') {
            throw new VoiceError('Invalid direction');
        }
        const json = parts[1];
        const dtlsId = parts[2];
        if (!json) {
            throw new VoiceError('Missing dtlsParameters');
        }
        const { dtlsParameters } = this.parseJson<{ dtlsParameters: DtlsParameters }>(json);
        await channel.connectTransport(connection, direction, dtlsParameters, dtlsId);
        connection.send('voice-connected', { direction });
    }

    private async handleProduce(param: string, connection: Connection) {
        const channel = this.requireChannel(connection);
        const session = connection.session;

        if (!this.canSpeakVoice(session)) {
            throw new VoiceError('You do not have permission to speak');
        }
        if (this.isBunkerGuestBlocked(session)) {
            throw new VoiceError('Speaking is disabled while bunker mode is on');
        }
        if (this.isVoiceMuted(session)) {
            throw new VoiceError('You are muted in voice');
        }
        // Shadowban: allow produce (preserve the illusion) but it is never announced/consumed.

        const { kind, rtpParameters } = this.parseJson<{ kind: MediaKind; rtpParameters: RtpParameters }>(param);
        const producer = await channel.produce(connection, kind, rtpParameters);
        connection.send('voice-producer-id', { id: producer.id });
    }

    private async handleConsume(param: string, connection: Connection) {
        const channel = this.requireChannel(connection);
        const producerId = param.trim();
        const result = await channel.consume(connection, producerId);
        connection.send('voice-consume', result);
    }

    private async handleVoiceMute(param: string, connection: Connection) {
        if (!this.canModerateVoice(connection.session)) {
            throw new VoiceError('You cannot moderate voice');
        }
        const target = Session.getSessionByIdentifier(param.trim().toLowerCase());
        if (!target) {
            throw new VoiceError('No such user');
        }
        // Toggle: if already muted, unmute; else mute and close their producer everywhere.
        const nowMuted = !this.isVoiceMuted(target);
        this.setVoiceMuted(target, nowMuted);
        if (nowMuted) {
            const channel = this.channelManager.getSessionChannel(target);
            channel?.closeSendSideForSession(target);
        }
    }

    private async handleVoiceKick(param: string, connection: Connection) {
        if (!this.canModerateVoice(connection.session)) {
            throw new VoiceError('You cannot moderate voice');
        }
        const target = Session.getSessionByIdentifier(param.trim().toLowerCase());
        if (!target) {
            throw new VoiceError('No such user');
        }
        // Eject from VOICE ONLY. Keep them in the room/text. (No connection.close().)
        this.channelManager.leaveChannel(target);
        if (target.user.id > 0) {
            this.saveUserData(target.user, { channel: null });
        }
    }

    // ---- lifecycle hooks ----

    public async onNewConnection(connection: Connection): Promise<void> {
        this.channelManager.sync([connection]);

        if (connection.session.user.isGuest()) {
            return;
        }
        const current = this.channelManager.getSessionChannel(connection.session);
        const saved = this.getUserData<{ channel: number | null }>(connection.session.user);
        const savedChannelId = saved?.channel ?? null;

        if (typeof savedChannelId === 'number' && (!current || savedChannelId !== current.id)) {
            // Re-gate before auto-rejoin (rights/ban may have changed since last session).
            if (
                this.canJoinVoice(connection.session) &&
                !this.isAccessBanned(connection) &&
                connection.room &&
                connection.room.accepts(connection.session) &&
                this.channelManager.getChannelById(savedChannelId)
            ) {
                await this.channelManager.joinChannel(connection.session, savedChannelId).catch(() => void 0);
            }
        } else if (current) {
            connection.send('voice-channel', current.id);
            connection.send('voice-router-caps', { channelId: current.id, rtpCapabilities: current.getRouterRtpCapabilities() });
            current.syncProducersTo(connection);
        }
    }

    public async onConnectionClosed(connection: Connection): Promise<void> {
        // THE single eviction path. Ban/kick/TOR all funnel here because they connection.close().
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (channel) {
            channel.closeConnection(connection);
        }
        if (connection.session.connections.length === 0) {
            this.channelManager.leaveChannel(connection.session);
            if (connection.session.user.id > 0) {
                this.saveUserData(connection.session.user, { channel: null });
            }
        }
        // Re-sync rosters so the user's avatar disappears from voice everywhere.
        this.channelManager.sync();
    }
}
