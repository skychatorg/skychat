import SQL from 'sql-template-strings';
import { DatabaseHelper } from './DatabaseHelper.js';
import { Logging } from './Logging.js';
import { Message, MessageStorage } from './Message.js';
import { UserController } from './UserController.js';

export type MessageDBRow = {
    id: number;
    room_id: number;
    user_id: number;
    quoted_message_id: number;
    date: Date;
    content: string;
    ip: string;
    storage: string;
};

export class MessageController {
    private static async buildMessagesFromRows(messageRows: MessageDBRow[]): Promise<Message[]> {
        const messages: Message[] = [];
        // Batch load all users in a single query
        const userIds = [...new Set(messageRows.map((r) => r.user_id).filter(Boolean))];
        const userMap = await UserController.getUsersByIds(userIds);
        for (const messageRow of messageRows) {
            const user = messageRow.user_id ? userMap.get(messageRow.user_id) : undefined;
            const resolvedUser = user || UserController.getNeutralUser('Guest');
            let storage: MessageStorage | undefined;
            try {
                storage = JSON.parse(messageRow.storage);
            } catch (error) {
                Logging.error('Failed to parse message storage', error);
                storage = {};
            }
            const encrypted = typeof storage?.e2ee !== 'undefined';
            messages.push(
                new Message({
                    id: messageRow.id,
                    room: messageRow.room_id,
                    content: messageRow.content,
                    createdTime: new Date(messageRow.date),
                    user: resolvedUser,
                    storage,
                    meta: {
                        _quoted_message_id: messageRow.quoted_message_id,
                        encrypted,
                        encryptionLabel: encrypted ? (storage?.e2ee as any)?.label ?? null : null,
                    },
                }),
            );
        }
        return messages;
    }

    static async getMessageById(id: number, fetchQuote: boolean): Promise<Message> {
        const message = (await MessageController.getMessages(['id', '=', id]))[0];
        if (!message) {
            throw new Error('Message not found');
        }

        // Load quoted message recursively
        if (fetchQuote && typeof message.meta._quoted_message_id === 'number') {
            message.quoted = await MessageController.getMessageById(message.meta._quoted_message_id, false);
        }
        return message;
    }

    /**
     *
     * @param conditions
     * @param order
     * @param limit
     * @returns {Message[]}
     */
    static async getMessages(conditions: any[][] | any[], order?: string, limit?: number): Promise<Message[]> {
        let sqlQuery = SQL`select id, room_id, user_id, quoted_message_id, date, content, ip, storage from messages where `;
        // Build conditions
        if (conditions.length > 0 && typeof conditions[0] === 'string') {
            conditions = [conditions];
        }
        for (let i = 0; i < conditions.length; ++i) {
            const condition = conditions[i];
            sqlQuery = sqlQuery.append(condition[0] + condition[1]).append(SQL`${condition[2]} `);
            if (i < conditions.length - 1) {
                sqlQuery = sqlQuery.append('AND ');
            }
        }
        // Order by
        if (order) {
            sqlQuery = sqlQuery.append('order by ' + order + ' ');
        }
        // Limit
        if (limit) {
            sqlQuery = sqlQuery.append('limit ' + limit + ' ');
        }
        // Get messages from db and build instances
        const messageRows: MessageDBRow[] = (await DatabaseHelper.db.query(sqlQuery)).rows;
        return MessageController.buildMessagesFromRows(messageRows);
    }

    static async searchMessages(roomId: number, query: string, limit: number): Promise<Message[]> {
        const escapedQuery = query.replace(/[%_]/g, '\\$&');
        const likeQuery = `%${escapedQuery}%`;
        const sqlQuery = SQL`
            select id, room_id, user_id, quoted_message_id, date, content, ip, storage
            from messages
            where room_id = ${roomId} and content ILIKE ${likeQuery} ESCAPE '\\'
            order by id DESC
            limit ${limit}
        `;

        const messageRows: MessageDBRow[] = (await DatabaseHelper.db.query(sqlQuery)).rows;
        return MessageController.buildMessagesFromRows(messageRows);
    }
}
