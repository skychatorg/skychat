import http from 'http';
import { RateLimiterMemory } from 'rate-limiter-flexible';

export class RateLimiter {
    static getIP(request: http.IncomingMessage): string {
        const forwardedForRaw = request.headers['x-forwarded-for'];
        const forwardedFor = Array.isArray(forwardedForRaw) ? forwardedForRaw : forwardedForRaw?.split(', ').map((l) => l.trim()) ?? [];
        return forwardedFor[0] ?? request.socket.remoteAddress;
    }

    static async rateLimit(rateLimiter: RateLimiterMemory, key: string, pointsToConsume?: number) {
        try {
            await rateLimiter.consume(key, pointsToConsume);
        } catch (error) {
            throw new Error('Rate limit check failed');
        }
    }
}
