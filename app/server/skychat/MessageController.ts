import SQL from 'sql-template-strings';
import { DatabaseHelper } from './DatabaseHelper';
import { Message } from './Message';
import { UserController } from './UserController';

export type MessageDBRow = {
    id: number;
    room_id: number;
    user_id: number;
    quoted_message_id: number;
    date: Date;
    content: string;
    ip: string;
};

export class MessageController {
    /**
     * Load a message instance from the database
     * @param id
     * @returns
     */
    static async getMessageById(id: number): Promise<Message> {
        const message = (await MessageController.getMessages(['id', '=', id]))[0];
        if (!message) {
            throw new Error('Message not found');
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
        let sqlQuery = SQL`select id, room_id, user_id, quoted_message_id, date, content, ip from messages where `;
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
        const messageRows: MessageDBRow[] = await DatabaseHelper.db.all(sqlQuery);
        const messages: Message[] = [];
        const users: any = {}; // User cache object to avoid non-necessary db queries
        for (const messageRow of messageRows) {
            try {
                if (!messageRow.user_id) {
                    throw new Error('User not found');
                }
                users[messageRow.user_id] = users[messageRow.user_id] || (await UserController.getUserById(messageRow.user_id));
            } catch (error) {
                users[messageRow.user_id] = UserController.getNeutralUser('Guest');
            }
            messages.push(
                new Message({
                    id: messageRow.id,
                    room: messageRow.room_id,
                    content: messageRow.content,
                    createdTime: new Date(messageRow.date),
                    user: users[messageRow.user_id],
                }),
            );
        }
        return messages;
    }
}
