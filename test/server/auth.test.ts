import { EventEmitter } from 'events';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthBridge } from '../../app/server/skychat/AuthBridge.js';
import { DatabaseHelper } from '../../app/server/skychat/DatabaseHelper.js';
import { HttpServer } from '../../app/server/skychat/HttpServer.js';
import { User } from '../../app/server/skychat/User.js';
import { UserController } from '../../app/server/skychat/UserController.js';
import { settle, TestServer } from './harness.js';

beforeAll(async () => {
    await new TestServer().start();
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** A socket waiting for its first message, the way AuthBridge gets it from the HTTP server */
class FakeSocket extends EventEmitter {
    readyState = 1;
    sent: { event: string; data: unknown }[] = [];
    send(raw: string) {
        this.sent.push(JSON.parse(raw));
    }
    close() {
        this.readyState = 3;
    }
}

function authBridge() {
    const http = new EventEmitter();
    const bridge = new AuthBridge(http as unknown as HttpServer);
    bridge.start();
    /** A new socket from `ip` sending its first message */
    const connect = async (ip: string, data: unknown) => {
        const socket = new FakeSocket();
        http.emit('connection-upgraded', { webSocket: socket, request: { headers: {}, socket: { remoteAddress: ip } } });
        socket.emit('message', Buffer.from(JSON.stringify(data)));
        await settle();
        return socket;
    };
    return { connect };
}

describe('register', () => {
    it('creates one account per IP and hour, and refuses the next before creating it', async () => {
        const register = vi.spyOn(UserController, 'register').mockResolvedValue(new User(999, 'new', null, '', 0, 0, 0));
        const { connect } = authBridge();

        await connect('10.9.0.1', { credentials: { register: true, username: 'first', password: 'pw' } });
        const second = await connect('10.9.0.1', { credentials: { register: true, username: 'second', password: 'pw' } });

        expect(register).toHaveBeenCalledTimes(1);
        expect(second.sent.at(-1)?.event).toBe('error');
    });

    it('checks the password before writing the account, so a bad one leaves no account behind', async () => {
        const query = vi.spyOn(DatabaseHelper.db, 'query');

        await expect(UserController.register('nopassword', '')).rejects.toThrow();

        expect(query).not.toHaveBeenCalled();
    });
});
