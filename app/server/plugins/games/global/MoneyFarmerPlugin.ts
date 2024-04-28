import { User } from '../../../skychat/User.js';
import { ConnectedListPlugin } from '../../core/global/ConnectedListPlugin.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { Session } from '../../../skychat/Session.js';
import { RoomManager } from '../../../skychat/RoomManager.js';

export class MoneyFarmerPlugin extends GlobalPlugin {
    public static readonly MAX_INACTIVITY_DURATION_MS: number = 5 * 60 * 1000;

    public static readonly TICK_AMOUNTS_LIMITS: { limit: number; amount: number }[] = [
        { limit: 15 * 100, amount: 3 },
        { limit: 30 * 100, amount: 2 },
        { limit: 100 * 100, amount: 1 },
    ];

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
