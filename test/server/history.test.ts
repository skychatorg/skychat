import { describe, expect, it } from 'vitest';
import { DatabaseHelper } from '../../app/server/skychat/DatabaseHelper.js';
import { MessageController } from '../../app/server/skychat/MessageController.js';
import { TestServer } from './harness.js';

describe('message history', () => {
    it('shows server messages as the server, not as a guest', async () => {
        const row = {
            id: 1,
            room_id: 1,
            user_id: -1,
            quoted_message_id: null,
            date: new Date(),
            content: 'Finished!',
            ip: null,
            storage: '{}',
        };
        DatabaseHelper.db = {
            query: async (query: string | { text: string }) => ({
                rows: /from messages/.test(typeof query === 'string' ? query : query.text) ? [row] : [],
            }),
        } as unknown as typeof DatabaseHelper.db;

        const [message] = await MessageController.getMessages(['room_id', '=', 1]);

        expect(message.user.username).toBe('[ Server ]');
    });

    it('keeps the quotes of messages loaded on boot', async () => {
        const server = await new TestServer().start();
        const room = server.roomManager.rooms[0];
        const row = (id: number, quoted: number | null) => ({
            id,
            room_id: room.id,
            user_id: -1,
            quoted_message_id: quoted,
            date: new Date(),
            content: `m${id}`,
            ip: null,
            storage: '{}',
        });
        // Message 3 quotes 2, which is in the loaded history, and 4 quotes 1, which is older and only in the DB
        DatabaseHelper.db = {
            query: async (query: string | { text: string; values?: unknown[] }) => {
                const text = typeof query === 'string' ? query : query.text;
                if (!/from messages/.test(text)) return { rows: [] };
                return { rows: /where id\s*=/.test(text) ? [row(1, null)] : [row(4, 1), row(3, 2), row(2, null)] };
            },
        } as unknown as typeof DatabaseHelper.db;

        await room.loadLastMessagesFromDB();

        expect(room.messages.map((m) => [m.id, m.quoted?.id ?? null])).toEqual([
            [2, null],
            [3, 2],
            [4, 1],
        ]);
    });
});
