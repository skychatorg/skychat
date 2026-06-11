import * as dns from 'dns/promises';
import * as mediasoup from 'mediasoup';
import type { Router, RouterRtpCodecCapability, WebRtcServer, WebRtcTransport, Worker } from 'mediasoup/node/lib/types.js';
import { Logging } from '../../skychat/Logging.js';

const VOICE_MEDIA_PORT = parseInt(process.env.VOICE_MEDIA_PORT ?? '44444', 10);
const VOICE_MAX_BITRATE = parseInt(process.env.VOICE_MAX_BITRATE ?? '32000', 10);

/** Opus only. DTX + in-band FEC are passthrough router params (no transcoding). */
const MEDIA_CODECS: RouterRtpCodecCapability[] = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
            useinbandfec: 1,
            usedtx: 1,
            maxaveragebitrate: VOICE_MAX_BITRATE,
        },
    },
];

/** RFC1918 + link-local ranges. A routable LAN address must not be announced. */
function isPrivateOrLoopback(ip: string): boolean {
    return (
        ip === '127.0.0.1' ||
        ip === '::1' ||
        /^10\./.test(ip) ||
        /^192\.168\./.test(ip) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip) ||
        /^169\.254\./.test(ip)
    );
}

function isLoopback(ip: string): boolean {
    return ip === '127.0.0.1' || ip === '::1';
}

/**
 * The single mediasoup Worker + WebRtcServer for the whole process. Holds the
 * load-bearing no-leak config (architecture section 4):
 *  - ICE-Lite (mediasoup default for WebRtcTransport): never gathers candidates.
 *  - one fixed media port, UDP + TCP, announcing ONLY the server's public IP.
 *  - no rtcMinPort/rtcMaxPort range, no internal IP advertised.
 */
export class VoiceSfu {
    private worker!: Worker;
    private webRtcServer!: WebRtcServer;
    private announcedIp!: string;
    private ready = false;

    public isReady(): boolean {
        return this.ready;
    }

    public getAnnouncedIp(): string {
        return this.announcedIp;
    }

    /**
     * Resolve VOICE_ANNOUNCED_IP to a literal and guard against misconfiguration.
     * Hostname -> A record. *.localhost -> 127.0.0.1. Rejects private/LAN ranges
     * unless ALLOW_PRIVATE_ANNOUNCED_IP=true (a LAN IP could be correlated by
     * clients on the same LAN and is almost always a production misconfig).
     */
    private async resolveAnnouncedIp(): Promise<string> {
        const raw = (process.env.VOICE_ANNOUNCED_IP ?? '').trim();
        const isDevContext =
            (process.env.PUBLIC_HOST ?? '').endsWith('.localhost') ||
            (process.env.PUBLIC_HOST ?? '') === 'localhost' ||
            (process.env.MODE ?? '').toUpperCase() !== 'PRODUCTION';
        const allowPrivate = (process.env.ALLOW_PRIVATE_ANNOUNCED_IP ?? '').toLowerCase() === 'true';

        let resolved: string;
        if (!raw || raw.endsWith('.localhost') || raw === 'localhost') {
            resolved = '127.0.0.1';
        } else if (/^[0-9.]+$/.test(raw) || raw.includes(':')) {
            // already an IP literal
            resolved = raw;
        } else {
            try {
                const [a] = await dns.resolve4(raw);
                resolved = a ?? '127.0.0.1';
            } catch {
                Logging.warn(`VoiceSfu: could not resolve VOICE_ANNOUNCED_IP=${raw}, falling back to 127.0.0.1`);
                resolved = '127.0.0.1';
            }
        }

        // Misconfiguration guard.
        if (isLoopback(resolved)) {
            const msg = `VoiceSfu: announced IP resolves to loopback (${resolved}); voice only works for same-machine testing`;
            if (isDevContext) {
                Logging.info(msg);
            } else {
                Logging.warn(msg);
            }
        } else if (isPrivateOrLoopback(resolved) && !allowPrivate) {
            throw new Error(
                `VoiceSfu: refusing to announce a private/LAN address (${resolved}). ` +
                    `Set VOICE_ANNOUNCED_IP to your public IPv4, or ALLOW_PRIVATE_ANNOUNCED_IP=true to override.`,
            );
        }

        return resolved;
    }

    public async init(): Promise<void> {
        this.announcedIp = await this.resolveAnnouncedIp();

        this.worker = await mediasoup.createWorker({
            logLevel: 'warn',
            // No rtcMinPort/rtcMaxPort range. We use a single fixed port via WebRtcServer.
        });
        this.worker.on('died', () => {
            Logging.error('VoiceSfu: mediasoup worker died — voice is down until restart');
            this.ready = false;
        });

        // Single fixed port, UDP + TCP, announcing ONLY the server's public IP.
        this.webRtcServer = await this.worker.createWebRtcServer({
            listenInfos: [
                {
                    protocol: 'udp',
                    ip: '0.0.0.0',
                    announcedAddress: this.announcedIp,
                    port: VOICE_MEDIA_PORT,
                },
                {
                    protocol: 'tcp',
                    ip: '0.0.0.0',
                    announcedAddress: this.announcedIp,
                    port: VOICE_MEDIA_PORT,
                },
            ],
        });

        this.ready = true;
        Logging.info(`VoiceSfu: mediasoup listening udp+tcp on ${VOICE_MEDIA_PORT}, announced ${this.announcedIp}`);
    }

    public async createRouter(): Promise<Router> {
        return this.worker.createRouter({ mediaCodecs: MEDIA_CODECS });
    }

    /**
     * Create a WebRtcTransport bound to the shared server. The router that owns
     * this transport is passed in (each channel has its own router).
     */
    public async createTransport(router: Router): Promise<WebRtcTransport> {
        return router.createWebRtcTransport({
            webRtcServer: this.webRtcServer,
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            // No iceServers here — that is a CLIENT concern; mediasoup-client uses iceServers:[].
        });
    }
}
