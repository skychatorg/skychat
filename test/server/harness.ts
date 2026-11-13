import { EventEmitter } from 'events';
import http from 'http';
import { WebSocket } from 'ws';
import { Connection } from '../../app/server/skychat/Connection.js';
import { DatabaseHelper } from '../../app/server/skychat/DatabaseHelper.js';
import { PluginManager } from '../../app/server/skychat/PluginManager.js';
import { RoomManager } from '../../app/server/skychat/RoomManager.js';
import { Session } from '../../app/server/skychat/Session.js';
import { User } from '../../app/server/skychat/User.js';
import { UserController } from '../../app/server/skychat/UserController.js';

type QueryConfig = string | { text: string; values?: unknown[] };

/**
 * In-memory stand-in for the pg client: inserts get fresh ids, everything else returns no rows.
 * Enough for the room and message flows, which keep their state in memory and only persist to the DB.
 * Money changes are kept, so a user's money history reads back.
 */
export function installFakeDb() {
    let nextId = 1;
    const queries: string[] = [];
    const moneyChanges: { userId: unknown; amount: unknown; reason: unknown; date: unknown }[] = [];
    DatabaseHelper.db = {
        query: async (query: QueryConfig) => {
            const text = typeof query === 'string' ? query : query.text;
            const values = typeof query === 'string' ? [] : query.values ?? [];
            queries.push(text);
            if (/^\s*insert into money_changes\b/i.test(text)) {
                const [userId, amount, , reason, date] = values;
                moneyChanges.unshift({ userId, amount, reason, date });
            }
            if (/from money_changes where user_id/i.test(text)) {
                const [userId, limit] = values;
                return { rows: moneyChanges.filter((change) => change.userId === userId).slice(0, limit as number) };
            }
            if (/^\s*insert\b[\s\S]*\breturning\s+id\b/i.test(text)) {
                return { rows: [{ id: nextId++ }], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        },
    } as unknown as typeof DatabaseHelper.db;
    return { queries };
}

class FakeWebSocket extends EventEmitter {
    readyState: number = WebSocket.OPEN;
    sent: Array<{ event: string; data: any }> = [];
    binary: Buffer[] = [];

    send(raw: string | Buffer) {
        if (typeof raw === 'string') {
            this.sent.push(JSON.parse(raw));
        } else {
            this.binary.push(raw);
        }
    }

    close() {
        this.readyState = WebSocket.CLOSED;
    }

    terminate() {
        this.readyState = WebSocket.CLOSED;
    }
}

export type TestClient = Awaited<ReturnType<TestServer['connect']>>;

/**
 * The real PluginManager and RoomManager, fed by fake sockets. Skips HttpServer and AuthBridge so nothing binds a port.
 */
export class TestServer {
    readonly pluginManager = new PluginManager();

    readonly roomManager = new RoomManager(this.pluginManager);

    private static nextUserId = 1;

    private static nextIp = 1;

    async start() {
        installFakeDb();
        this.pluginManager.start(this.roomManager);
        await this.roomManager.start();
        return this;
    }

    /**
     * Connect a logged-in user (or a guest when username is null), the way SkyChatServer.onConnectionAccepted does
     */
    async connect(username: string | null, right = 0) {
        let session: Session;
        let user: User | undefined;
        if (username) {
            user = new User(TestServer.nextUserId++, username, null, '', 0, 0, right);
            session = await UserController.getOrCreateUserSession(user);
        } else {
            session = new Session(`*guest#${TestServer.nextUserId++}`);
        }
        const ws = new FakeWebSocket();
        // Every client gets its own IP so per-IP rate limits do not leak between tests
        const request = {
            headers: {},
            socket: { remoteAddress: `10.0.${Math.floor(TestServer.nextIp / 250)}.${TestServer.nextIp++ % 250}` },
        };
        const webSocket = ws as unknown as WebSocket;
        const connection = new Connection(session, webSocket, request as unknown as http.IncomingMessage);
        await this.roomManager.onConnectionCreated(connection);
        await this.pluginManager.onConnectionCreated(connection, { webSocket, request: request as http.IncomingMessage, data: {}, user });
        return {
            connection,
            session,
            ws,
            /** Send a command the way the socket would, and wait for it to be handled */
            async send(payload: string) {
                connection.emit('message', payload);
                await settle();
            },
            events(name: string) {
                return ws.sent.filter((e) => e.event === name).map((e) => e.data);
            },
            last(name: string) {
                return this.events(name).at(-1);
            },
            errors() {
                return this.events('error') as string[];
            },
            clear() {
                ws.sent.length = 0;
            },
        };
    }
}

/**
 * Commands run on a promise queue, and every DB call here resolves right away, so a short wait lets them finish
 */
export function settle(ms = 30) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
