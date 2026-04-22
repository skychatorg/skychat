import express from 'express';
import { pipeline } from 'node:stream/promises';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Logging } from '../../../skychat/Logging.js';
import { PluginRoute } from '../../GlobalPlugin.js';
import { JELLYFIN_ID_REGEX, JellyfinClient, JellyfinFetcher, msToTicks, verifyStreamToken } from './JellyfinFetcher.js';

const INT_RE = /^\d{1,3}$/;
const BIG_INT_RE = /^\d{1,15}$/;

// Per-user rate limits. Media streaming needs a generous budget (seeking fires lots of range
// requests) but a single user should not be able to DoS the event loop.
const streamLimiter = new RateLimiterMemory({ points: 60, duration: 1 });
const lightLimiter = new RateLimiterMemory({ points: 15, duration: 1 });
// Posters get their own, roomier budget: a scroll through the library fires many at once, and
// they should not contend with subtitle fetches on the shared light limiter.
const imageLimiter = new RateLimiterMemory({ points: 40, duration: 1 });

function sanitizeError(err: unknown): { status: number; message: string } {
    Logging.warn(`Jellyfin proxy upstream error: ${(err as Error)?.message ?? String(err)}`);
    return { status: 502, message: 'upstream error' };
}

function authenticate(req: express.Request): { userId: number } | null {
    const token = typeof req.query.t === 'string' ? req.query.t : '';
    return verifyStreamToken(token);
}

async function rateLimit(limiter: RateLimiterMemory, userId: number, res: express.Response): Promise<boolean> {
    try {
        await limiter.consume(String(userId));
        return true;
    } catch {
        res.status(429).end();
        return false;
    }
}

async function streamUpstream(req: express.Request, res: express.Response, client: JellyfinClient, relativeUrl: string): Promise<void> {
    const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    try {
        const upstream = await client.rawHttp.get(relativeUrl, {
            headers: range ? { Range: range } : {},
            responseType: 'stream',
            validateStatus: () => true,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            decompress: false,
        });

        if (upstream.status >= 400) {
            const sanitized = sanitizeError(new Error(`upstream ${upstream.status}`));
            upstream.data.destroy();
            res.status(sanitized.status).json(sanitized);
            return;
        }

        const headers: Record<string, string> = {};
        for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
            const v = upstream.headers[name];
            if (typeof v === 'string') {
                headers[name] = v;
            }
        }
        res.writeHead(upstream.status, headers);

        // Destroy the upstream stream if the client disconnects mid-transfer (seek, tab close).
        const onClose = () => {
            upstream.data.destroy();
        };
        req.on('close', onClose);

        try {
            await pipeline(upstream.data, res);
        } catch (err) {
            // Client aborted or upstream errored — both are normal; log at debug level.
            Logging.info(`Jellyfin proxy pipeline ended: ${(err as Error).message}`);
        } finally {
            req.off('close', onClose);
        }
    } catch (err) {
        const sanitized = sanitizeError(err);
        if (!res.headersSent) {
            res.status(sanitized.status).json(sanitized);
        } else {
            res.end();
        }
    }
}

export function buildJellyfinRoutes(fetcher: JellyfinFetcher): PluginRoute[] {
    const handleStream: PluginRoute['handler'] = async (req, res) => {
        if (!fetcher.enabled) {
            res.status(503).json({ message: 'Jellyfin not configured' });
            return;
        }
        const auth = authenticate(req);
        if (!auth) {
            res.status(401).end();
            return;
        }
        if (!(await rateLimit(streamLimiter, auth.userId, res))) return;

        const { itemId } = req.params;
        const mediaSourceId = typeof req.query.mediaSourceId === 'string' ? req.query.mediaSourceId : '';
        const audioStreamIndex = typeof req.query.audioStreamIndex === 'string' ? req.query.audioStreamIndex : undefined;
        const startTimeMsStr = typeof req.query.startTimeMs === 'string' ? req.query.startTimeMs : undefined;

        if (!JELLYFIN_ID_REGEX.test(itemId) || !JELLYFIN_ID_REGEX.test(mediaSourceId)) {
            res.status(400).end();
            return;
        }
        if (audioStreamIndex !== undefined && !INT_RE.test(audioStreamIndex)) {
            res.status(400).end();
            return;
        }
        if (startTimeMsStr !== undefined && !BIG_INT_RE.test(startTimeMsStr)) {
            res.status(400).end();
            return;
        }

        // We need a PlaySessionId to route the stream request. Mint a fresh one per stream request
        // so the proxy stays stateless. For pure remux sessions (PlayMethod=DirectStream) Jellyfin's
        // ffmpeg worker exits when the HTTP response ends, so there's no session to explicitly stop.
        let playSessionId: string;
        try {
            const client = fetcher.client;
            const userId = await client.resolveUserId();
            const info = await client.getPlaybackInfo(userId, itemId);
            playSessionId = info.PlaySessionId;
        } catch (err) {
            const sanitized = sanitizeError(err);
            res.status(sanitized.status).json(sanitized);
            return;
        }

        const audioIdx = audioStreamIndex !== undefined ? parseInt(audioStreamIndex, 10) : undefined;
        const startTimeTicks = startTimeMsStr !== undefined ? parseInt(startTimeMsStr, 10) * 10_000 : undefined;
        const upstreamPath = fetcher.client.buildRemuxStreamPath(itemId, mediaSourceId, playSessionId, audioIdx, startTimeTicks);
        await streamUpstream(req, res, fetcher.client, upstreamPath);
    };

    const handleSubtitle: PluginRoute['handler'] = async (req, res) => {
        if (!fetcher.enabled) {
            res.status(503).json({ message: 'Jellyfin not configured' });
            return;
        }
        const auth = authenticate(req);
        if (!auth) {
            res.status(401).end();
            return;
        }
        if (!(await rateLimit(lightLimiter, auth.userId, res))) return;

        const { itemId, mediaSourceId, index } = req.params;
        const startTimeMsStr = typeof req.query.startTimeMs === 'string' ? req.query.startTimeMs : undefined;
        if (!JELLYFIN_ID_REGEX.test(itemId) || !JELLYFIN_ID_REGEX.test(mediaSourceId) || !INT_RE.test(index)) {
            res.status(400).end();
            return;
        }
        if (startTimeMsStr !== undefined && !BIG_INT_RE.test(startTimeMsStr)) {
            res.status(400).end();
            return;
        }

        // Subtitle cues must be rebased to the same offset as the video stream, else they drift
        // from the picture after a seek. See JellyfinClient.buildSubtitleVttPath.
        const startTimeTicks = startTimeMsStr !== undefined ? msToTicks(parseInt(startTimeMsStr, 10)) : undefined;
        const client = fetcher.client;
        const upstreamPath = client.buildSubtitleVttPath(itemId, mediaSourceId, parseInt(index, 10), startTimeTicks);
        await streamUpstream(req, res, client, upstreamPath);
    };

    const handleImage: PluginRoute['handler'] = async (req, res) => {
        if (!fetcher.enabled) {
            res.status(503).json({ message: 'Jellyfin not configured' });
            return;
        }
        const auth = authenticate(req);
        if (!auth) {
            res.status(401).end();
            return;
        }
        if (!(await rateLimit(imageLimiter, auth.userId, res))) return;

        const { itemId, type } = req.params;
        if (!JELLYFIN_ID_REGEX.test(itemId)) {
            res.status(400).end();
            return;
        }
        if (!/^(Primary|Backdrop|Thumb)$/.test(type)) {
            res.status(400).end();
            return;
        }

        const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
        const client = fetcher.client;
        const upstreamPath = client.buildImagePath(itemId, type as 'Primary' | 'Backdrop' | 'Thumb', tag);
        await streamUpstream(req, res, client, upstreamPath);
    };

    return [
        { method: 'get', path: 'jellyfin/stream/:itemId', handler: handleStream },
        { method: 'get', path: 'jellyfin/subtitle/:itemId/:mediaSourceId/:index.vtt', handler: handleSubtitle },
        { method: 'get', path: 'jellyfin/image/:itemId/:type', handler: handleImage },
    ];
}
