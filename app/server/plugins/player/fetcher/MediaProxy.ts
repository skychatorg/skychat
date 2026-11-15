import { AxiosInstance } from 'axios';
import express from 'express';
import { pipeline } from 'node:stream/promises';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Logging } from '../../../skychat/Logging.js';
import { verifyStreamToken } from './JellyfinFetcher.js';

// Shared by the Jellyfin and Navidrome proxies: clients never talk to either upstream directly.

export function sanitizeError(err: unknown): { status: number; message: string } {
    Logging.warn(`Media proxy upstream error: ${(err as Error)?.message ?? String(err)}`);
    return { status: 502, message: 'upstream error' };
}

export function authenticate(req: express.Request): { userId: number } | null {
    const token = typeof req.query.t === 'string' ? req.query.t : '';
    return verifyStreamToken(token);
}

export async function rateLimit(limiter: RateLimiterMemory, userId: number, res: express.Response): Promise<boolean> {
    try {
        await limiter.consume(String(userId));
        return true;
    } catch {
        res.status(429).end();
        return false;
    }
}

export async function streamUpstream(req: express.Request, res: express.Response, http: AxiosInstance, relativeUrl: string): Promise<void> {
    const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    try {
        const upstream = await http.get(relativeUrl, {
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
            Logging.info(`Media proxy pipeline ended: ${(err as Error).message}`);
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
