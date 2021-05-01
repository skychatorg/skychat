import {Connection} from "../../Connection";
import {GlobalPlugin} from "../../GlobalPlugin";
import {ConnectedListPlugin} from "./ConnectedListPlugin";
import {UserController} from "../../UserController";
import { Config } from "../../Config";
import * as striptags from "striptags";
import { User } from "../../User";
import { Message } from "../../Message";
import { Session } from "../../Session";
import { RoomManager } from "../../RoomManager";


export class RankPlugin extends GlobalPlugin {

    public static readonly MAX_INACTIVITY_DURATION_MS: number = 10 * 60 * 1000;

    static readonly commandName = 'rank';

    readonly minRight = -1;

    constructor(manager: RoomManager) {
        super(manager);

        setInterval(this.tick.bind(this), 60 * 1000);
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Get user rank
        const userRank = User.getRankByXp(connection.session.user.xp);

        // Build HTML
        let rankHtml = `All ranks: <table>`
            + Config.PREFERENCES.ranks
                .slice(0)
                .sort((a, b) => a.limit - b.limit)
                .map(rank => `
                    <tr>
                        <td><img src="/assets/images/${rank.images['18']}"></td>
                        <td style="text-align: right">${rank.limit}</td>
                        <td style="padding-left: 1em">${userRank.limit === rank.limit ? '← you are here' : ''}</td>
                    </tr>`)
                .join('')
            + `</table>`;

        const message = new Message(
            {
                id: 0,
                room: connection.roomId,
                formatted: rankHtml,
                content: striptags(rankHtml),
                user: UserController.getNeutralUser()
            }
        );
        connection.send('message', message.sanitized());
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
            if (session.lastMessageDate.getTime() + RankPlugin.MAX_INACTIVITY_DURATION_MS < new Date().getTime()) {
                continue;
            }

            await UserController.giveXP(session.user, 1);
        }
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
