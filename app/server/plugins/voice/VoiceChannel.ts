import type {
    Consumer,
    DtlsParameters,
    MediaKind,
    Producer,
    Router,
    RtpCapabilities,
    RtpParameters,
    WebRtcTransport,
} from 'mediasoup/node/lib/types.js';
import { Connection } from '../../skychat/Connection.js';
import { Session } from '../../skychat/Session.js';
import { VoiceError } from './VoiceError.js';
import { verifyVoiceDtlsId } from './VoiceToken.js';
import { SanitizedVoiceChannel, VoiceConsumeParams, VoiceProducerInfo, VoiceTransportDirection } from './VoiceTypes.js';
import { VoiceChannelManager } from './VoiceChannelManager.js';
import { VoiceSfu } from './VoiceSfu.js';

type VoicePeer = {
    connection: Connection;
    sendTransport: WebRtcTransport | null;
    recvTransport: WebRtcTransport | null;
    producer: Producer | null;
    consumers: Map<string /* producerId */, Consumer>;
    rtpCapabilities: RtpCapabilities | null;
};

/**
 * One voice channel. Mirrors PlayerChannel. Owns one mediasoup Router, the list of
 * sessions, and per-connection transport/producer/consumer bookkeeping. All per-pair
 * moderation filtering (blacklist, shadowban) lives here.
 */
export class VoiceChannel {
    public readonly id: number;
    public name: string;
    public readonly manager: VoiceChannelManager;
    public readonly sessions: Session[] = [];

    private router: Router | null = null;
    private readonly peers: Map<Connection, VoicePeer> = new Map();

    constructor(manager: VoiceChannelManager, id: number, name: string) {
        this.manager = manager;
        this.id = id;
        this.name = name;
    }

    private get sfu(): VoiceSfu {
        return this.manager.plugin.sfu;
    }

    private get plugin() {
        return this.manager.plugin;
    }

    /** Ensure the channel's router exists (created on first join). */
    public async ensureRouter(): Promise<Router> {
        if (!this.router) {
            this.router = await this.sfu.createRouter();
        }
        return this.router;
    }

    public getRouterRtpCapabilities() {
        if (!this.router) {
            throw new VoiceError('Voice channel not initialized');
        }
        return this.router.rtpCapabilities;
    }

    // ---- membership ----

    public addSession(session: Session) {
        if (!this.sessions.includes(session)) {
            this.sessions.push(session);
        }
    }

    public removeSession(session: Session) {
        const i = this.sessions.indexOf(session);
        if (i !== -1) {
            this.sessions.splice(i, 1);
        }
    }

    private peer(connection: Connection): VoicePeer {
        let p = this.peers.get(connection);
        if (!p) {
            p = {
                connection,
                sendTransport: null,
                recvTransport: null,
                producer: null,
                consumers: new Map(),
                rtpCapabilities: null,
            };
            this.peers.set(connection, p);
        }
        return p;
    }

    // ---- transports ----

    public async createTransport(connection: Connection, direction: VoiceTransportDirection): Promise<WebRtcTransport> {
        const router = await this.ensureRouter();
        const transport = await this.sfu.createTransport(router);
        const peer = this.peer(connection);
        if (direction === 'send') {
            peer.sendTransport?.close();
            peer.sendTransport = transport;
        } else {
            peer.recvTransport?.close();
            peer.recvTransport = transport;
        }
        return transport;
    }

    public setRtpCapabilities(connection: Connection, rtpCapabilities: RtpCapabilities) {
        this.peer(connection).rtpCapabilities = rtpCapabilities;
    }

    public getRtpCapabilities(connection: Connection): RtpCapabilities {
        const caps = this.peers.get(connection)?.rtpCapabilities;
        if (!caps) {
            throw new VoiceError('Device capabilities not received yet');
        }
        return caps;
    }

    public async connectTransport(
        connection: Connection,
        direction: VoiceTransportDirection,
        dtlsParameters: DtlsParameters,
        dtlsId?: string,
    ) {
        const peer = this.peers.get(connection);
        const transport = direction === 'send' ? peer?.sendTransport : peer?.recvTransport;
        if (!transport) {
            throw new VoiceError('No such transport');
        }
        // Defense-in-depth: if the client echoes the dtlsId, the token must be valid, bound to
        // THIS transport and THIS channel, and unexpired. Rejects a stale transport.connect after
        // a fast reconnect (the old transport.id is gone, so the old token no longer matches).
        if (typeof dtlsId === 'string' && dtlsId.length > 0) {
            const decoded = verifyVoiceDtlsId(dtlsId);
            if (!decoded || decoded.transportId !== transport.id || decoded.channelId !== this.id) {
                throw new VoiceError('Stale or invalid voice transport token');
            }
        }
        await transport.connect({ dtlsParameters });
    }

    // ---- produce ----

    /**
     * Create the mic producer. Caller (VoicePlugin) already gated canSpeak + !bunkerGuest + !voicemute.
     * Shadowbanned users are allowed to produce (illusion) but never announced/consumed.
     */
    public async produce(connection: Connection, kind: MediaKind, rtpParameters: RtpParameters): Promise<Producer> {
        const peer = this.peer(connection);
        if (!peer.sendTransport) {
            throw new VoiceError('No send transport');
        }
        peer.producer?.close();
        const producer = await peer.sendTransport.produce({ kind, rtpParameters });
        peer.producer = producer;
        producer.on('transportclose', () => {
            if (peer.producer === producer) {
                peer.producer = null;
            }
        });
        this.announceProducer(connection, producer);
        return producer;
    }

    /** Tell every other session about this producer, skipping blacklist-pair / shadowbanned. */
    private announceProducer(owner: Connection, producer: Producer) {
        const ownerSession = owner.session;
        // Shadowbanned producers are never announced.
        if (this.plugin.isShadowBanned(owner)) {
            return;
        }
        const info: VoiceProducerInfo = {
            producerId: producer.id,
            userId: ownerSession.user.id,
            username: ownerSession.user.username,
        };
        for (const session of this.sessions) {
            if (session === ownerSession) {
                continue;
            }
            if (this.plugin.isPairBlocked(ownerSession, session)) {
                continue;
            }
            session.send('voice-sync', { channelId: this.id, producers: [info] });
        }
    }

    // ---- consume ----

    /**
     * Consume a remote producer for `connection`. Per-pair filtering: if subscriber blocked
     * owner (or vice-versa), or owner is shadowbanned, refuse.
     */
    public async consume(connection: Connection, producerId: string): Promise<VoiceConsumeParams> {
        const router = await this.ensureRouter();
        const ownerPeer = this.findProducerOwner(producerId);
        if (!ownerPeer || !ownerPeer.producer) {
            throw new VoiceError('No such producer');
        }
        const ownerSession = ownerPeer.connection.session;
        const subscriberSession = connection.session;

        if (ownerSession === subscriberSession) {
            throw new VoiceError('Cannot consume own producer');
        }
        if (this.plugin.isShadowBanned(ownerPeer.connection)) {
            throw new VoiceError('Cannot consume');
        }
        if (this.plugin.isPairBlocked(ownerSession, subscriberSession)) {
            throw new VoiceError('Cannot consume');
        }

        const rtpCapabilities = this.getRtpCapabilities(connection);
        if (!router.canConsume({ producerId, rtpCapabilities })) {
            throw new VoiceError('Cannot consume (incompatible capabilities)');
        }

        const peer = this.peer(connection);
        if (!peer.recvTransport) {
            throw new VoiceError('No recv transport');
        }
        // Replace any existing consumer for this producer.
        peer.consumers.get(producerId)?.close();
        const consumer = await peer.recvTransport.consume({ producerId, rtpCapabilities, paused: false });
        peer.consumers.set(producerId, consumer);
        consumer.on('transportclose', () => peer.consumers.delete(producerId));
        consumer.on('producerclose', () => {
            peer.consumers.delete(producerId);
            connection.send('voice-producer-closed', { producerId });
        });

        return {
            consumerId: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            userId: ownerSession.user.id,
            username: ownerSession.user.username,
        };
    }

    private findProducerOwner(producerId: string): VoicePeer | null {
        for (const p of this.peers.values()) {
            if (p.producer?.id === producerId) {
                return p;
            }
        }
        return null;
    }

    // ---- moderation actions ----

    /** Close (hard mute) a session's producer in this channel, across all its connections. */
    public closeSendSideForSession(session: Session) {
        for (const connection of session.connections) {
            const peer = this.peers.get(connection);
            if (!peer) {
                continue;
            }
            peer.producer?.close();
            peer.producer = null;
            peer.sendTransport?.close();
            peer.sendTransport = null;
        }
    }

    /**
     * Re-evaluate per-pair / shadowban filtering for live consumers and close the ones that
     * are no longer allowed. The follow-up voice-sync re-opens any that became allowed again.
     */
    public refilterConsumers() {
        for (const subPeer of this.peers.values()) {
            for (const [producerId, consumer] of [...subPeer.consumers]) {
                const owner = this.findProducerOwner(producerId);
                const blocked =
                    !owner ||
                    this.plugin.isShadowBanned(owner.connection) ||
                    this.plugin.isPairBlocked(owner.connection.session, subPeer.connection.session);
                if (blocked) {
                    consumer.close();
                    subPeer.consumers.delete(producerId);
                    subPeer.connection.send('voice-producer-closed', { producerId });
                }
            }
        }
    }

    /**
     * Live policy re-evaluation. Evicts sessions that lost room/join access, downgrades those
     * that lost speak rights (bunker guest / voicemute), and re-filters consumers for
     * shadowban / blacklist. The architecture's VoiceChannel.revalidate.
     */
    public revalidate() {
        const plugin = this.plugin;
        for (const session of [...this.sessions]) {
            const conn = session.connections[0];
            // Lost room/join access or banned -> full eviction from voice.
            if (!conn || !conn.room || !conn.room.accepts(session) || plugin.isAccessBanned(conn) || !plugin.canJoinVoice(session)) {
                this.manager.leaveChannel(session);
                continue;
            }
            // Lost speak right (incl. bunker guest / voicemute) -> downgrade to listener.
            if (!plugin.canSpeakVoice(session) || plugin.isBunkerGuestBlocked(session) || plugin.isVoiceMuted(session)) {
                this.closeSendSideForSession(session);
            }
        }
        // Shadowban / blacklist: close now-forbidden consumers, then re-push producer lists.
        this.refilterConsumers();
        for (const session of this.sessions) {
            this.syncProducersToSession(session);
        }
    }

    // ---- cleanup (single eviction path) ----

    /** Close everything for one connection. Called from onConnectionClosed, kick, ban, etc. */
    public closeConnection(connection: Connection) {
        const peer = this.peers.get(connection);
        if (!peer) {
            return;
        }
        peer.producer?.close();
        for (const c of peer.consumers.values()) {
            c.close();
        }
        peer.sendTransport?.close();
        peer.recvTransport?.close();
        this.peers.delete(connection);
    }

    // ---- sync ----

    private buildProducerListFor(subscriber: Session): VoiceProducerInfo[] {
        const producers: VoiceProducerInfo[] = [];
        for (const p of this.peers.values()) {
            if (!p.producer) {
                continue;
            }
            const ownerSession = p.connection.session;
            if (ownerSession === subscriber) {
                continue;
            }
            if (this.plugin.isShadowBanned(p.connection)) {
                continue;
            }
            if (this.plugin.isPairBlocked(ownerSession, subscriber)) {
                continue;
            }
            producers.push({ producerId: p.producer.id, userId: ownerSession.user.id, username: ownerSession.user.username });
        }
        return producers;
    }

    /** Push the current (filtered) producer list to one connection. */
    public syncProducersTo(connection: Connection) {
        connection.send('voice-sync', { channelId: this.id, producers: this.buildProducerListFor(connection.session) });
    }

    /** Push the current (filtered) producer list to all connections of a session. */
    public syncProducersToSession(session: Session) {
        const producers = this.buildProducerListFor(session);
        for (const connection of session.connections) {
            connection.send('voice-sync', { channelId: this.id, producers });
        }
    }

    /**
     * Per-viewer roster: usernames the viewer is allowed to see. Self is always visible;
     * shadowbanned-by-others and blacklist pairs are filtered out. NEVER carries an IP.
     */
    public sanitizedFor(viewer: Session): SanitizedVoiceChannel {
        const usernames = new Set<string>();
        for (const member of this.sessions) {
            if (member !== viewer) {
                if (this.plugin.isSessionShadowBanned(member)) {
                    continue;
                }
                if (this.plugin.isPairBlocked(member, viewer)) {
                    continue;
                }
            }
            usernames.add(member.user.username);
        }
        return { id: this.id, name: this.name, users: [...usernames] };
    }
}
