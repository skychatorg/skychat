import fs from 'fs';
import { AddressInfo } from 'net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GlobalPlugin } from '../../app/server/plugins/GlobalPlugin.js';
import { HttpServer } from '../../app/server/skychat/HttpServer.js';
import { UserController } from '../../app/server/skychat/UserController.js';
import { TestServer } from './harness.js';

let url: string;
let http: { httpServer: import('http').Server };
let server: TestServer;

beforeAll(async () => {
    server = await new TestServer().start();
    const httpServer = new HttpServer();
    httpServer.registerPluginRoutes([server.roomManager.getPlugin('upload') as unknown as GlobalPlugin]);
    http = httpServer as unknown as typeof http;
    await new Promise<void>((resolve) => http.httpServer.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(http.httpServer.address() as AddressInfo).port}/api/upload`;
});

afterAll(() => {
    http.httpServer.close();
});

afterEach(() => {
    vi.restoreAllMocks();
});

const tempFiles = () => fs.readdirSync('/tmp').filter((name) => name.startsWith('tmp-'));

async function upload(type: string, headers: Record<string, string> = {}) {
    const body = new FormData();
    body.append('file', new Blob(['%PDF-1.4 test'], { type }), 'test.pdf');
    return (await fetch(url, { method: 'POST', body, headers })).json();
}

/** The header the client sends: the login token it keeps */
async function loggedIn() {
    const { user } = (await server.connect(`uploader${Date.now()}`)).session;
    vi.spyOn(UserController, 'getUserById').mockResolvedValue(user);
    return { 'X-Auth-Token': JSON.stringify(UserController.getAuthToken(user.id)) };
}

describe('upload', () => {
    it('refuses a guest, before reading the file', async () => {
        const before = tempFiles();

        const result = await upload('application/pdf');

        expect(result).toMatchObject({ status: 500, message: expect.stringContaining('Log in') });
        expect(tempFiles()).toEqual(before);
    });

    it('saves a logged-in user’s file', async () => {
        const result = await upload('application/pdf', await loggedIn());

        expect(result.status).toBe(200);
        expect(fs.existsSync(result.path)).toBe(true);
    });

    it('leaves no temp file behind when it refuses the file', async () => {
        const headers = await loggedIn();
        const before = tempFiles();

        const result = await upload('text/html', headers);

        expect(result).toMatchObject({ status: 500, message: expect.stringContaining('Invalid mimetype') });
        expect(tempFiles()).toEqual(before);
    });
});
