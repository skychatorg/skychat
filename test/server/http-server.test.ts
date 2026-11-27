import { describe, expect, it } from 'vitest';
import { Connection } from '../../app/server/skychat/Connection.js';
import { HttpServer } from '../../app/server/skychat/HttpServer.js';

describe('websocket server', () => {
    // ws buffers a whole frame before anything else runs, the login message included: 100 MiB by default
    it('refuses frames bigger than what a connection may send in 10 s anyway', () => {
        const server = new HttpServer() as unknown as { wss: { options: { maxPayload: number } } };

        expect(server.wss.options.maxPayload).toBe(Connection.MAX_RECEIVED_BYTES_PER_10_SEC);
    });
});
