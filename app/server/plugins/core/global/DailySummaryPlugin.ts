import SQL from 'sql-template-strings';
import { DatabaseHelper } from '../../../skychat/DatabaseHelper.js';
import { Logging } from '../../../skychat/Logging.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

type RoomStats = {
    room_id: number;
    message_count: number;
    unique_users: number;
};

export class DailySummaryPlugin extends GlobalPlugin {
    static readonly commandName = 'dailysummary';

    static readonly commandAliases = [];

    readonly minRight = 0;

    readonly opOnly = true;

    readonly rules = {
        dailysummary: {
            minCount: 0,
            maxCount: 0,
            coolDown: 60000,
        },
    };

    /**
     * Scheduled time in hours. 20.0 = 8 PM
     */
    public static readonly SCHEDULED_TIME: number = 20.0;

    constructor(manager: RoomManager) {
        super(manager);

        if (this.manager) {
            this.armTimer();
        }
    }

    async run(): Promise<void> {
        await this.postDailySummary();
    }

    private armTimer(): void {
        const now = new Date().getHours() + new Date().getMinutes() / 60;
        let duration = DailySummaryPlugin.SCHEDULED_TIME - now;
        if (duration <= 0) {
            duration += 24;
        }
        const ms = duration * 60 * 60 * 1000;
        Logging.info(`DailySummaryPlugin: Next summary in ${duration.toFixed(2)} hours`);
        setTimeout(this.onScheduledTime.bind(this), ms);
    }

    private async onScheduledTime(): Promise<void> {
        await this.postDailySummary();
        this.armTimer();
    }

    private async postDailySummary(): Promise<void> {
        // Find the main room
        const mainRoom = this.manager.rooms.find((room) => room.main);
        if (!mainRoom) {
            Logging.warn('DailySummaryPlugin: No main room configured, skipping summary');
            return;
        }

        // Calculate time range (last 24 hours)
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Get stats from database
        const result = await DatabaseHelper.db.query(SQL`
            SELECT
                room_id,
                COUNT(*) as message_count,
                COUNT(DISTINCT user_id) as unique_users
            FROM messages
            WHERE date >= ${yesterday} AND date < ${now}
            GROUP BY room_id
        `);

        const stats: RoomStats[] = result.rows as RoomStats[];

        // Get public room names
        const publicRooms = this.manager.rooms.filter((room) => !room.isPrivate);

        // Build summary content
        let content = 'Daily Summary (last 24h)\n';

        let totalMessages = 0;

        for (const room of publicRooms) {
            const roomStats = stats.find((s) => s.room_id === room.id);
            const messageCount = roomStats ? Number(roomStats.message_count) : 0;
            const uniqueUsers = roomStats ? Number(roomStats.unique_users) : 0;

            if (messageCount > 0) {
                content += `- ${room.name}: ${messageCount} messages, ${uniqueUsers} active users\n`;
                totalMessages += messageCount;
            }
        }

        // Get total unique users across all public rooms
        const publicRoomIds = publicRooms.map((r) => r.id);
        let totalUniqueUsers = 0;
        if (publicRoomIds.length > 0) {
            const totalUsersResult = await DatabaseHelper.db.query({
                text: `SELECT COUNT(DISTINCT user_id) as total_users
                       FROM messages
                       WHERE date >= $1 AND date < $2
                       AND room_id = ANY($3)`,
                values: [yesterday, now, publicRoomIds],
            });
            totalUniqueUsers = totalUsersResult.rows[0]?.total_users || 0;
        }

        content += `\nTotal: ${totalMessages} messages, ${totalUniqueUsers} unique users`;

        // Send to main room
        await mainRoom.sendMessage({
            content,
            user: UserController.getNeutralUser(),
        });

        Logging.info(`DailySummaryPlugin: Posted summary to main room ${mainRoom.id}`);
    }
}
