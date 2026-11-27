import { formatMoney } from '../../../../api/money.js';
import { User } from '../../../skychat/User.js';
import { ConnectedListPlugin } from '../../core/global/ConnectedListPlugin.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { Session } from '../../../skychat/Session.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { logFailure } from '../../../skychat/Logging.js';
import { DailyRoll } from '../../player/party/DailyRoll.js';

type AllowanceData = { day: number; streak: number };

export class MoneyFarmerPlugin extends GlobalPlugin {
    public static readonly MAX_INACTIVITY_DURATION_MS: number = 5 * 60 * 1000;

    /** Cents per minute of chat: a broke player who chats can afford a $10 bet within the hour, rich players get nothing */
    public static readonly TICK_AMOUNTS_LIMITS: { limit: number; amount: number }[] = [
        { limit: 10 * 100, amount: 15 },
        { limit: 30 * 100, amount: 5 },
        { limit: 100 * 100, amount: 2 },
    ];

    /** Paid the first time a player chats each day: $20, then $5 more for each day in a row, up to $50 */
    public static readonly ALLOWANCE = { first: 20 * 100, perDay: 5 * 100, max: 50 * 100 };

    /** The day of the last allowance (the Daily Roll's reset that ends it), and how many days in a row */
    static readonly defaultDataStorageValue: AllowanceData = { day: 0, streak: 0 };

    static readonly commandName = 'moneyfarmer';

    readonly minRight = -1;

    readonly callable = false;

    constructor(manager: RoomManager) {
        super(manager);

        setInterval(() => logFailure(this.tick(), 'Money farmer'), 60 * 1000);
    }

    async run(): Promise<void> {
        void 0;
    }

    /**
     * Get the amount to give to a specific user for this tick
     * @param user
     */
    private getTickAmount(user: User): number {
        const entry = MoneyFarmerPlugin.TICK_AMOUNTS_LIMITS.filter((entry) => entry.limit >= user.money)[0];
        return entry ? entry.amount : 0;
    }

    /** What a streak of `days` pays */
    public static allowanceFor(days: number): number {
        const { first, perDay, max } = MoneyFarmerPlugin.ALLOWANCE;
        return Math.min(max, first + (days - 1) * perDay);
    }

    /** A day ends at the Daily Roll's reset, 10 PM in Geneva: it is named after that instant */
    private async allowance(session: Session): Promise<void> {
        const today = DailyRoll.nextReset(Date.now());
        const saved = this.getUserData<AllowanceData | number>(session.user);
        // Older saves hold the date of a bailout: a fresh start
        const last = typeof saved === 'object' && saved ? saved : { day: 0, streak: 0 };
        if (last.day === today) {
            return;
        }
        // Yesterday ended at the reset before today's; 26 hours back lands in yesterday whatever daylight saving does
        const streak = last.day === DailyRoll.nextReset(today - 26 * 60 * 60 * 1000) ? last.streak + 1 : 1;
        const amount = MoneyFarmerPlugin.allowanceFor(streak);
        await this.saveUserData(session.user, { day: today, streak });
        await UserController.giveMoney(session.user, amount, 'Daily allowance');
        const next = MoneyFarmerPlugin.allowanceFor(streak + 1);
        // Its own event, so the client can ring a coin with the toast
        session.send(
            'allowance',
            `Daily allowance: ${formatMoney(amount)}` +
                (streak > 1 ? ` (${streak} days in a row)` : '') +
                (next > amount ? `. Come back tomorrow for ${formatMoney(next)}` : ''),
        );
    }

    private async tick(): Promise<void> {
        for (const session of Session.activeLoggedSessions(MoneyFarmerPlugin.MAX_INACTIVITY_DURATION_MS)) {
            await this.allowance(session);
            const amount = this.getTickAmount(session.user);
            if (amount === 0) {
                continue;
            }
            session.user.money += amount;
            await UserController.sync(session.user);
        }
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
