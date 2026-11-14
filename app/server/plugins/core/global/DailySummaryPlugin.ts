import SQL from 'sql-template-strings';
import { formatMoney } from '../../../../api/money.js';
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

type GameStats = {
    username: string;
    net: number;
    bet: number;
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

    /**
     * How many winners and losers of the games are named
     */
    public static readonly GAMES_TOP: number = 3;

    /**
     * Days the money changes are kept
     */
    public static readonly MONEY_RETENTION: number = 30;

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
        try {
            const expired = new Date(Date.now() - DailySummaryPlugin.MONEY_RETENTION * 24 * 60 * 60 * 1000);
            await DatabaseHelper.db.query(SQL`DELETE FROM money_changes WHERE date < ${expired}`);
        } catch (error) {
            Logging.error('DailySummaryPlugin: Could not remove old money changes', error);
        }
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
        // The games must never cost the room stats
        try {
            content += await this.getGamesSummary(yesterday, now);
        } catch (error) {
            Logging.error('DailySummaryPlugin: Could not summarize the games', error);
        }

        // Send to main room
        await mainRoom.sendMessage({
            content,
            user: UserController.getNeutralUser(),
        });

        Logging.info(`DailySummaryPlugin: Posted summary to main room ${mainRoom.id}`);
    }

    /**
     * What the party games took and gave: empty when nobody played
     */
    private async getGamesSummary(from: Date, to: Date): Promise<string> {
        // Amounts are signed: a refund cancels its bet, so it counts in neither
        const result = await DatabaseHelper.db.query(SQL`
            SELECT
                users.username_custom as username,
                SUM(money_changes.amount) as net,
                -SUM(CASE WHEN money_changes.kind IN ('bet', 'refund') THEN money_changes.amount ELSE 0 END) as bet
            FROM money_changes
            JOIN users ON users.id = money_changes.user_id
            WHERE money_changes.kind <> 'other' AND money_changes.date >= ${from} AND money_changes.date < ${to}
            GROUP BY users.id
        `);

        // Someone whose bets all came back did not play
        const stats: GameStats[] = result.rows
            .map((row) => ({ username: row.username, net: Number(row.net), bet: Number(row.bet) }))
            .filter((s) => s.bet > 0 || s.net !== 0);
        if (stats.length === 0) {
            return '';
        }

        // Daily Roll is free: its winners are named, but they bet nothing
        const totalBet = stats.reduce((total, s) => total + s.bet, 0);
        const bettors = stats.filter((s) => s.bet > 0).length;
        let content = `\n\nGames: ${formatMoney(totalBet)} bet`;
        if (bettors > 0) {
            content += ` by ${bettors} ${bettors > 1 ? 'players' : 'player'}`;
        }

        const winners = stats
            .filter((s) => s.net > 0)
            .sort((a, b) => b.net - a.net)
            .slice(0, DailySummaryPlugin.GAMES_TOP)
            .map((s) => `${s.username} +${formatMoney(s.net)}`);
        if (winners.length > 0) {
            content += `\n- Winners: ${winners.join(', ')}`;
        }

        const losers = stats
            .filter((s) => s.net < 0)
            .sort((a, b) => a.net - b.net)
            .slice(0, DailySummaryPlugin.GAMES_TOP)
            .map((s) => `${s.username} ${formatMoney(s.net)}`);
        if (losers.length > 0) {
            content += `\n- Losers: ${losers.join(', ')}`;
        }

        return content;
    }
}
