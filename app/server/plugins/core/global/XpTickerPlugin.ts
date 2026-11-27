import { GlobalPlugin } from '../../GlobalPlugin.js';
import { ConnectedListPlugin } from './ConnectedListPlugin.js';
import { UserController } from '../../../skychat/UserController.js';
import { Session } from '../../../skychat/Session.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { logFailure } from '../../../skychat/Logging.js';

export class XpTickerPlugin extends GlobalPlugin {
    public static readonly MAX_INACTIVITY_DURATION_MS: number = 5 * 60 * 1000;

    static readonly commandName = 'xp';

    callable = false;

    constructor(manager: RoomManager) {
        super(manager);

        setInterval(() => logFailure(this.tick(), 'XP ticker'), 60 * 1000);
    }

    async run(): Promise<void> {
        throw new Error('Not implemented');
    }

    private async tick(): Promise<void> {
        for (const session of Session.activeLoggedSessions(XpTickerPlugin.MAX_INACTIVITY_DURATION_MS)) {
            await UserController.giveXP(session.user, 1);
        }
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
