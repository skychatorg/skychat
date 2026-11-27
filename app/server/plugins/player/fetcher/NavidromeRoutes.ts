import { RateLimiterMemory } from 'rate-limiter-flexible';
import { PluginRoute } from '../../GlobalPlugin.js';
import { authenticate, rateLimit, sanitizeError, streamUpstream } from './MediaProxy.js';
import { NAVIDROME_COVER_REGEX, NAVIDROME_ID_REGEX, NavidromeFetcher } from './NavidromeFetcher.js';

// Tracks are served from the local cache, so seeking (many range requests) costs nothing upstream.
const streamLimiter = new RateLimiterMemory({ points: 60, duration: 1 });
// A scroll through the album grid fires many covers at once.
const coverLimiter = new RateLimiterMemory({ points: 60, duration: 1 });

const COVER_SIZES = new Set(['80', '300', '600']);

// Only songs playing or queued somewhere can be streamed: a token holder can't make the server download the library
// eslint-disable-next-line no-unused-vars
export function buildNavidromeRoutes(fetcher: NavidromeFetcher, isPlayingOrQueued: (id: string) => boolean): PluginRoute[] {
    const handleStream: PluginRoute['handler'] = async (req, res) => {
        if (!fetcher.enabled) {
            res.status(503).json({ message: 'Navidrome not configured' });
            return;
        }
        const auth = authenticate(req);
        if (!auth) {
            res.status(401).end();
            return;
        }
        if (!(await rateLimit(streamLimiter, auth.userId, res))) return;

        const { id } = req.params;
        if (!NAVIDROME_ID_REGEX.test(id)) {
            res.status(400).end();
            return;
        }
        if (!isPlayingOrQueued(id)) {
            res.status(404).end();
            return;
        }
        let file: string;
        try {
            file = await fetcher.cache.get(id);
        } catch (err) {
            const sanitized = sanitizeError(err);
            res.status(sanitized.status).json(sanitized);
            return;
        }
        // sendFile answers Range requests, which is what lets every listener seek freely.
        res.sendFile(file, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' } });
    };

    const handleCover: PluginRoute['handler'] = async (req, res) => {
        if (!fetcher.enabled) {
            res.status(503).json({ message: 'Navidrome not configured' });
            return;
        }
        const auth = authenticate(req);
        if (!auth) {
            res.status(401).end();
            return;
        }
        if (!(await rateLimit(coverLimiter, auth.userId, res))) return;

        const { coverArt } = req.params;
        const size = typeof req.query.size === 'string' ? req.query.size : '300';
        if (!NAVIDROME_COVER_REGEX.test(coverArt) || !COVER_SIZES.has(size)) {
            res.status(400).end();
            return;
        }
        await streamUpstream(req, res, fetcher.client.rawHttp, fetcher.client.coverPath(coverArt, parseInt(size, 10)));
    };

    return [
        { method: 'get', path: 'navidrome/stream/:id', handler: handleStream },
        { method: 'get', path: 'navidrome/cover/:coverArt', handler: handleCover },
    ];
}
