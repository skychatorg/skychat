import { describe, expect, it } from 'vitest';
import { DatabaseHelper } from '../../app/server/skychat/DatabaseHelper.js';
import { MessageController } from '../../app/server/skychat/MessageController.js';

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
});
