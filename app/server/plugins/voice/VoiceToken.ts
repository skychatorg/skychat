import * as crypto from 'crypto';

// sessionId, transportId, channelId, exp
type VoiceDtlsPayload = { s: string; t: string; ch: number; e: number };

function getSalt(): string {
    const salt = process.env.USERS_TOKEN_SALT;
    if (!salt) {
        throw new Error('USERS_TOKEN_SALT not set');
    }
    return salt;
}

/**
 * Mint a short HMAC token binding a transport to {sessionId, transportId, channelId, exp}.
 * Defense-in-depth only: reuses the existing HMAC pattern (issueStreamToken), no jsonwebtoken.
 * It lets the in-process SFU reject a stale transport.connect after a fast reconnect.
 */
export function issueVoiceDtlsId(args: { sessionId: string; transportId: string; channelId: number; exp: number }): string {
    const payload = Buffer.from(
        JSON.stringify({ s: args.sessionId, t: args.transportId, ch: args.channelId, e: args.exp } satisfies VoiceDtlsPayload),
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', getSalt()).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

export function verifyVoiceDtlsId(token: string): { sessionId: string; transportId: string; channelId: number } | null {
    if (typeof token !== 'string') {
        return null;
    }
    const dot = token.indexOf('.');
    if (dot <= 0 || dot === token.length - 1) {
        return null;
    }
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    let expected: Uint8Array;
    let given: Uint8Array;
    try {
        expected = new Uint8Array(crypto.createHmac('sha256', getSalt()).update(payload).digest());
        given = new Uint8Array(Buffer.from(sig, 'base64url'));
    } catch {
        return null;
    }
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
        return null;
    }
    let parsed: VoiceDtlsPayload;
    try {
        parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as VoiceDtlsPayload;
    } catch {
        return null;
    }
    if (typeof parsed.s !== 'string' || typeof parsed.t !== 'string' || typeof parsed.ch !== 'number' || Date.now() > parsed.e) {
        return null;
    }
    return { sessionId: parsed.s, transportId: parsed.t, channelId: parsed.ch };
}
