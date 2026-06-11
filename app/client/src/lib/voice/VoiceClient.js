import { Device } from 'mediasoup-client';
import hark from 'hark';

const MIC_CONSTRAINTS = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 },
    video: false,
};

// HARD RULE (constraint #1): no STUN, no TURN, ever. The only remote ICE candidate the
// browser sees is the SFU's announced address, delivered by the server in voice-transport.
const ICE_SERVERS = [];

/**
 * Drives the mediasoup-client side of voice. One instance per joined voice channel.
 * Talks to the server purely through SkyChatClient: client.sendMessage('/voice...') out,
 * and client.on('voice-*', ...) in. Owns no socket of its own. The only file that imports
 * mediasoup-client and hark.
 */
export class VoiceClient {
    constructor(client, hooks = {}) {
        this.client = client;
        this.hooks = hooks;

        this.device = null;
        this.sendTransport = null;
        this.recvTransport = null;

        this.micStream = null;
        this.micProducer = null;
        this.localHark = null;

        /** @type {Map<string, { consumer, stream, audioEl, hark, userId, username }>} */
        this.consumers = new Map();

        // local-only state
        this.muted = false;
        this.deafened = false;
        this.pushToTalk = false;
        this.talkKeyDown = false;
        this.volumes = new Map(); // userId -> 0..1
        this.locallyMuted = new Set(); // userIds
        this.inputDeviceId = null;

        this._produceWhenReady = false;
        this._onceProducerId = null;
        this._dtlsIds = { send: null, recv: null };

        this._bound = this._bindEvents();
    }

    // ---- device + transports -------------------------------------------

    async loadDevice(routerRtpCapabilities) {
        if (this.device) {
            return;
        }
        this.device = new Device();
        await this.device.load({ routerRtpCapabilities });
        // Tell the server our device caps (server needs them for canConsume).
        this.client.sendMessage(`/voicertpcaps ${JSON.stringify({ rtpCapabilities: this.device.rtpCapabilities })}`);
        // Build the recv transport immediately so we can hear others even as a listener.
        this.client.sendMessage('/voicetransport recv');
    }

    _createTransport(params) {
        const { direction } = params;
        const options = {
            id: params.id,
            iceParameters: params.iceParameters,
            iceCandidates: params.iceCandidates, // SERVER candidates only
            dtlsParameters: params.dtlsParameters,
            iceServers: ICE_SERVERS, // [] — no STUN/TURN
            iceTransportPolicy: 'all', // allow ICE-TCP fallback on the same port
        };
        this._dtlsIds[direction] = params.dtlsId ?? null;

        const transport = direction === 'send' ? this.device.createSendTransport(options) : this.device.createRecvTransport(options);

        transport.on('connect', ({ dtlsParameters }, callback, errback) => {
            try {
                const idArg = this._dtlsIds[direction] ? ` ${this._dtlsIds[direction]}` : '';
                this.client.sendMessage(`/voiceconnect ${direction} ${JSON.stringify(dtlsParameters)}${idArg}`);
                // No per-call ack; resolve optimistically. A server rejection closes the transport.
                callback();
            } catch (err) {
                errback(err);
            }
        });

        if (direction === 'send') {
            transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
                try {
                    this._onceProducerId = (id) => callback({ id });
                    this.client.sendMessage(`/voiceproduce ${JSON.stringify({ kind, rtpParameters })}`);
                } catch (err) {
                    errback(err);
                }
            });
        }

        transport.on('connectionstatechange', (state) => {
            if (state === 'failed' || state === 'closed') {
                this.hooks.onError?.(`voice transport ${direction} ${state}`);
            }
        });

        if (direction === 'send') {
            this.sendTransport = transport;
        } else {
            this.recvTransport = transport;
        }
    }

    // ---- producing (mic) -----------------------------------------------

    async startMic() {
        if (this.micProducer || this.micStream) {
            return;
        }
        this.micStream = await navigator.mediaDevices.getUserMedia(this._micConstraints());
        this.localHark = hark(this.micStream, { interval: 100, threshold: -65 });
        this.localHark.on('speaking', () => this.hooks.onSpeaking?.(this._selfId(), true));
        this.localHark.on('stopped_speaking', () => this.hooks.onSpeaking?.(this._selfId(), false));
        if (!this.sendTransport) {
            this._produceWhenReady = true;
            this.client.sendMessage('/voicetransport send');
        } else {
            await this._produce();
        }
    }

    async _produce() {
        if (this.micProducer || !this.micStream) {
            return;
        }
        const track = this.micStream.getAudioTracks()[0];
        this.micProducer = await this.sendTransport.produce({
            track,
            codecOptions: { opusStereo: false, opusDtx: true, opusFec: true },
            encodings: [{ maxBitrate: 32000 }],
        });
        this._applyMicGate();
        this.hooks.onStateChange?.();
    }

    _micConstraints() {
        const c = JSON.parse(JSON.stringify(MIC_CONSTRAINTS));
        if (this.inputDeviceId) {
            c.audio.deviceId = { exact: this.inputDeviceId };
        }
        return c;
    }

    _selfId() {
        return this.client.state.user.id;
    }

    // ---- consuming (remote audio) --------------------------------------

    requestConsume(producerId) {
        if (this.consumers.has(producerId)) {
            return;
        }
        this.client.sendMessage(`/voiceconsume ${producerId}`);
    }

    async addConsumer({ consumerId, producerId, kind, rtpParameters, userId, username }) {
        if (kind !== 'audio' || !this.recvTransport) {
            return;
        }
        if (this.consumers.has(producerId)) {
            return;
        }
        const consumer = await this.recvTransport.consume({ id: consumerId, producerId, kind, rtpParameters });
        const stream = new MediaStream([consumer.track]);

        const audioEl = new Audio();
        audioEl.srcObject = stream;
        audioEl.autoplay = true;
        audioEl.muted = this.deafened || this.locallyMuted.has(userId);
        audioEl.volume = this.volumes.get(userId) ?? 1;
        audioEl.play().catch(() => {});

        const remoteHark = hark(stream, { interval: 100, threshold: -65 });
        remoteHark.on('speaking', () => this.hooks.onSpeaking?.(userId, true));
        remoteHark.on('stopped_speaking', () => this.hooks.onSpeaking?.(userId, false));

        this.consumers.set(producerId, { consumer, stream, audioEl, hark: remoteHark, userId, username });
    }

    removeConsumer(producerId) {
        const c = this.consumers.get(producerId);
        if (!c) {
            return;
        }
        c.hark?.stop();
        c.consumer.close();
        c.audioEl.srcObject = null;
        if (c.userId !== undefined) {
            this.hooks.onSpeaking?.(c.userId, false);
        }
        this.consumers.delete(producerId);
    }

    /** Reconcile against the latest voice-sync producer list. */
    syncProducers(producers) {
        const wanted = new Set(producers.map((p) => p.producerId));
        for (const p of producers) {
            this.requestConsume(p.producerId);
        }
        for (const pid of [...this.consumers.keys()]) {
            if (!wanted.has(pid)) {
                this.removeConsumer(pid);
            }
        }
    }

    // ---- local controls (no server round-trip) -------------------------

    setMuted(muted) {
        this.muted = muted;
        this._applyMicGate();
        this.hooks.onStateChange?.();
    }

    setDeafened(d) {
        this.deafened = d;
        for (const c of this.consumers.values()) {
            c.audioEl.muted = d || this.locallyMuted.has(c.userId);
        }
        if (d) {
            this.setMuted(true);
        }
        this.hooks.onStateChange?.();
    }

    setUserVolume(userId, vol) {
        this.volumes.set(userId, vol);
        for (const c of this.consumers.values()) {
            if (c.userId === userId) {
                c.audioEl.volume = vol;
            }
        }
    }

    setUserLocallyMuted(userId, muted) {
        if (muted) {
            this.locallyMuted.add(userId);
        } else {
            this.locallyMuted.delete(userId);
        }
        for (const c of this.consumers.values()) {
            if (c.userId === userId) {
                c.audioEl.muted = muted || this.deafened;
            }
        }
        this.hooks.onStateChange?.();
    }

    setPushToTalk(enabled) {
        this.pushToTalk = enabled;
        this._applyMicGate();
        this.hooks.onStateChange?.();
    }

    setTalkKey(down) {
        this.talkKeyDown = down;
        this._applyMicGate();
    }

    /** Decide whether the mic producer is paused right now. */
    _applyMicGate() {
        if (!this.micProducer) {
            return;
        }
        const open = !this.muted && (!this.pushToTalk || this.talkKeyDown);
        if (open && this.micProducer.paused) {
            this.micProducer.resume();
        }
        if (!open && !this.micProducer.paused) {
            this.micProducer.pause();
        }
    }

    async setInputDevice(deviceId) {
        this.inputDeviceId = deviceId;
        if (!this.micProducer) {
            return;
        }
        const stream = await navigator.mediaDevices.getUserMedia(this._micConstraints());
        const track = stream.getAudioTracks()[0];
        await this.micProducer.replaceTrack({ track });
        this.micStream.getTracks().forEach((t) => t.stop());
        this.micStream = stream;
    }

    static async listInputDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((d) => d.kind === 'audioinput');
    }

    // ---- teardown ------------------------------------------------------

    stop() {
        this._unbindEvents();
        this.localHark?.stop();
        for (const pid of [...this.consumers.keys()]) {
            this.removeConsumer(pid);
        }
        try {
            this.micProducer?.close();
        } catch {
            // already closed
        }
        this.micStream?.getTracks().forEach((t) => t.stop());
        this.sendTransport?.close();
        this.recvTransport?.close();
        this.device = null;
        this.sendTransport = this.recvTransport = null;
        this.micStream = this.micProducer = this.localHark = null;
    }

    // ---- event wiring --------------------------------------------------

    _bindEvents() {
        const on = (ev, fn) => {
            this.client.on(ev, fn);
            return [ev, fn];
        };
        return [
            on('voice-router-caps', ({ rtpCapabilities }) => this.loadDevice(rtpCapabilities)),
            on('voice-transport', (params) => {
                this._createTransport(params);
                if (params.direction === 'send' && this._produceWhenReady) {
                    this._produceWhenReady = false;
                    this._produce();
                }
            }),
            on('voice-producer-id', ({ id }) => {
                this._onceProducerId?.(id);
                this._onceProducerId = null;
            }),
            on('voice-sync', ({ producers }) => this.syncProducers(producers ?? [])),
            on('voice-consume', (p) => this.addConsumer(p)),
            on('voice-producer-closed', ({ producerId }) => this.removeConsumer(producerId)),
        ];
    }

    _unbindEvents() {
        for (const [ev, fn] of this._bound) {
            this.client.off(ev, fn);
        }
    }
}
