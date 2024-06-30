import EventEmitter from 'events';
import http from 'http';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { WebSocket } from 'ws';
import { WS_CLOSE_CODE_ERROR } from '../constants.js';
import { ConnectionUpgradeEvent, HttpServer } from './HttpServer.js';
import { Logging } from './Logging.js';
import { RateLimiter } from './RateLimiter.js';
import { AuthToken, User } from './User.js';
import { UserController } from './UserController.js';

export type AuthData = {
    roomId?: number;

    credentials?: {
        register?: boolean;
        username: string;
        password: string;
    };

    token?: Partial<AuthToken>;
};

export type ConnectionAcceptedEvent = {
    webSocket: WebSocket;
    request: http.IncomingMessage;
    data: AuthData;
    user?: User;
};

/**
 * @emits connection-accepted
 */
export class AuthBridge extends EventEmitter {
    static readonly TICK_INTERVAL = 4 * 1000;

    static readonly MAX_REGISTER_PER_HOUR = 1;

    static readonly MAX_LOGIN_PER_MINUTE = 10;

    static readonly MAX_GUEST_PER_MINUTE = 8;

    static readonly MAX_TOKEN_AUTH_PER_MINUTE = 20;

    /**
     * Max number of websockets pending for authentication per IP.
     */
    static readonly WS_MAX_PENDING_FOR_AUTH_PER_IP = 3;

    private readonly server: HttpServer;

    private readonly pendingSockets: Map<string, WebSocket[]> = new Map();

    private readonly registerLimiter: RateLimiterMemory = new RateLimiterMemory({
        points: AuthBridge.MAX_REGISTER_PER_HOUR,
        duration: 60 * 60,
    });

    private readonly loginLimiter: RateLimiterMemory = new RateLimiterMemory({
        points: AuthBridge.MAX_LOGIN_PER_MINUTE,
        duration: 60,
    });

    private readonly guestLimiter: RateLimiterMemory = new RateLimiterMemory({
        points: AuthBridge.MAX_GUEST_PER_MINUTE,
        duration: 60,
    });

    private readonly tokenAuthLimiter: RateLimiterMemory = new RateLimiterMemory({
        points: AuthBridge.MAX_TOKEN_AUTH_PER_MINUTE,
        duration: 60,
    });

    constructor(server: HttpServer) {
        super();

        this.server = server;
    }

    start() {
        this.server.on('connection-upgraded', this.onConnectionUpgraded.bind(this));

        setInterval(this.tick.bind(this), AuthBridge.TICK_INTERVAL);
        this.on('connection-accepted', this.onConnectionAccepted.bind(this));
    }

    private async onConnectionAccepted({ webSocket, request }: ConnectionAcceptedEvent) {
        // Drop websocket from pendingSockets
        const ip = RateLimiter.getIP(request);
        const pendingSockets = this.pendingSockets.get(ip);
        if (pendingSockets) {
            this.pendingSockets.set(
                ip,
                pendingSockets.filter((socket) => socket !== webSocket),
            );
        }

        // Notify websocket
        webSocket.send(JSON.stringify({ event: 'connection-accepted' }));
    }

    private tick() {
        for (const [ip, sockets] of this.pendingSockets) {
            // Cleanup closed sockets
            this.pendingSockets.set(
                ip,
                sockets.filter((socket) => socket.readyState === WebSocket.OPEN),
            );

            // Cleanup empty arrays
            if (sockets.length === 0) {
                this.pendingSockets.delete(ip);
            }
        }
    }

    private onConnectionUpgraded({ webSocket, request }: ConnectionUpgradeEvent) {
        const ip = RateLimiter.getIP(request);

        // (Should not happen) the request has been closed before the upgrade
        if (typeof ip !== 'string') {
            webSocket.close(WS_CLOSE_CODE_ERROR, 'Invalid request');
            return;
        }

        // Initialize the pendingSockets map
        if (!this.pendingSockets.has(ip)) {
            this.pendingSockets.set(ip, []);
        }

        const pendingSockets = this.pendingSockets.get(ip)!;

        // Too many pending sockets?
        if (pendingSockets.length >= AuthBridge.WS_MAX_PENDING_FOR_AUTH_PER_IP) {
            this.sendError(webSocket, 'Too many pending connections. Are you using the latest client?');
            webSocket.close(WS_CLOSE_CODE_ERROR);
            return;
        }

        // Add the socket to the pendingSockets map
        this.pendingSockets.get(ip)?.push(webSocket);
        Logging.info(`Accepting connection from ${ip} (pending: ${pendingSockets.length})`);

        // Wait for the first message (auth data)
        webSocket.once('message', this.onMessage.bind(this, webSocket, request));
    }

    private async onMessage(webSocket: WebSocket, request: http.IncomingMessage, buffer: Buffer) {
        try {
            if (!(buffer instanceof Buffer)) {
                throw new Error('Expected buffer, received ' + typeof buffer);
            }
            const data = JSON.parse(buffer.toString()) as AuthData;

            // Auth with token
            if (data.token) {
                if (!data.token.signature || !data.token.timestamp || !data.token.userId) {
                    throw new Error('Missing token data');
                }
                await RateLimiter.rateLimitSafe(this.tokenAuthLimiter, RateLimiter.getIP(request));
                const user = await UserController.verifyAuthToken(data.token as AuthToken);
                this.emit('connection-accepted', { webSocket, request, data, user });
                return;
            } else if (data.credentials?.register) {
                // Register
                const user = await UserController.register(data.credentials.username, data.credentials.password);
                await RateLimiter.rateLimitSafe(this.registerLimiter, RateLimiter.getIP(request));
                this.emit('connection-accepted', { webSocket, request, data, user });
                return;
            } else if (data.credentials) {
                // Login
                await RateLimiter.rateLimitSafe(this.loginLimiter, RateLimiter.getIP(request));
                const user = await UserController.login(data.credentials.username, data.credentials.password);
                this.emit('connection-accepted', { webSocket, request, data, user });
                return;
            } else {
                // Guest login
                await RateLimiter.rateLimitSafe(this.guestLimiter, RateLimiter.getIP(request));
                this.emit('connection-accepted', { webSocket, request, data });
            }
        } catch (error) {
            this.sendError(webSocket, `${error}`);
            webSocket.once('message', this.onMessage.bind(this, webSocket, request));
        }
    }

    private sendError(webSocket: WebSocket, message: string) {
        webSocket.send(
            JSON.stringify({
                event: 'error',
                data: message,
            }),
        );
    }
}
