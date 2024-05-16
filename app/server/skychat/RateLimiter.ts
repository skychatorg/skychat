import http from 'http';
import { RateLimiterMemory } from 'rate-limiter-flexible';

export class RateLimiter {
    static readonly DEFAULT_IP_HEADER = 'x-forwarded-for';

    static getIP(request: http.IncomingMessage): string {
        const trustedHeaderName = process.env.TRUSTED_IP_HEADER?.toLowerCase() || RateLimiter.DEFAULT_IP_HEADER;
        const trustedHeaderIp = trustedHeaderName ? request.headers[trustedHeaderName] : null;
        if (trustedHeaderName && trustedHeaderIp) {
            if (Array.isArray(trustedHeaderIp)) {
                return trustedHeaderIp[0] ?? request.socket.remoteAddress ?? 'unknown';
            } else {
                return trustedHeaderIp;
            }
        }
        return request.socket.remoteAddress ?? 'unknown';
    }

    /**
     * Rate limit without risking leaking information on error
     */
    static async rateLimitSafe(rateLimiter: RateLimiterMemory, key: string, pointsToConsume?: number) {
        try {
            await rateLimiter.consume(key, pointsToConsume);
        } catch (error) {
            throw new Error(`Rate limit check failed`);
        }
    }
}
