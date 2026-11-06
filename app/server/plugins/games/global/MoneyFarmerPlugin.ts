import { formatMoney } from '../../../../api/money.js';
import { User } from '../../../skychat/User.js';
import { ConnectedListPlugin } from '../../core/global/ConnectedListPlugin.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { Session } from '../../../skychat/Session.js';
import { RoomManager } from '../../../skychat/RoomManager.js';

export class MoneyFarmerPlugin extends GlobalPlugin {
    public static readonly MAX_INACTIVITY_DURATION_MS: number = 5 * 60 * 1000;

    /** Cents per minute of chat: a broke player who chats can afford a $10 bet within the hour, rich players get nothing */
    public static readonly TICK_AMOUNTS_LIMITS: { limit: number; amount: number }[] = [
        { limit: 10 * 100, amount: 15 },
        { limit: 30 * 100, amount: 5 },
        { limit: 100 * 100, amount: 2 },
    ];

    /** Under $1 nothing in the party is affordable: active players get $10 once a day to play again right away */
    public static readonly BAILOUT = { below: 100, amount: 10 * 100, everyMs: 24 * 60 * 60 * 1000 };

    /** When the user last got the bailout, in ms */
    static readonly defaultDataStorageValue = 0;

    static readonly commandName = 'moneyfarmer';

    readonly minRight = -1;

    readonly callable = false;

    constructor(manager: RoomManager) {
        super(manager);

        setInterval(this.tick.bind(this), 60 * 1000);
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

    private async bailout(session: Session): Promise<boolean> {
        const { below, amount, everyMs } = MoneyFarmerPlugin.BAILOUT;
        if (session.user.money >= below || Date.now() - this.getUserData<number>(session.user) < everyMs) {
            return false;
        }
        await this.saveUserData(session.user, Date.now());
        await UserController.giveMoney(session.user, amount, 'Daily bailout');
        session.send('info', `You were broke, here is ${formatMoney(amount)} to play again. Once a day.`);
        return true;
    }

    private async tick(): Promise<void> {
        // Get all sessions
        const sessions = Object.values(Session.sessions);
        // For each session in the room
        for (const session of sessions) {
            // If it's not a logged session, continue
            if (session.user.right < 0) {
                continue;
            }
            // If user inactive for too long, continue
            if (session.lastPublicMessageSentDate.getTime() + MoneyFarmerPlugin.MAX_INACTIVITY_DURATION_MS < new Date().getTime()) {
                continue;
            }

            if (await this.bailout(session)) {
                continue;
            }
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
