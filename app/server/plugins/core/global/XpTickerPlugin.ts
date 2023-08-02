import { GlobalPlugin } from '../../GlobalPlugin';
import { ConnectedListPlugin } from './ConnectedListPlugin';
import { UserController } from '../../../skychat/UserController';
import { Session } from '../../../skychat/Session';
import { RoomManager } from '../../../skychat/RoomManager';

export class XpTickerPlugin extends GlobalPlugin {
    public static readonly MAX_INACTIVITY_DURATION_MS: number = 5 * 60 * 1000;

    static readonly commandName = 'xp';

    callable = false;

    constructor(manager: RoomManager) {
        super(manager);

        setInterval(this.tick.bind(this), 60 * 1000);
    }

    async run(): Promise<void> {
        throw new Error('Not implemented');
    }

    private async tick(): Promise<void> {
        // Get rooms in the session
        const sessions = Object.values(Session.sessions);
        // For each session in the room
        for (const session of sessions) {
            // If it's not a logged session, continue
            if (session.user.right < 0) {
                continue;
            }
            // If user inactive for too long, continue
            if (session.lastPublicMessageSentDate.getTime() + XpTickerPlugin.MAX_INACTIVITY_DURATION_MS < new Date().getTime()) {
                continue;
            }
            await UserController.giveXP(session.user, 1);
        }
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
