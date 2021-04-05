import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {Room} from "../../../Room";
import {ConnectedListPlugin} from "./ConnectedListPlugin";
import {UserController} from "../../../UserController";
import { Config } from "../../../Config";
import * as striptags from "striptags";
import { User } from "../../../User";
import { Message } from "../../../Message";


export class RankPlugin extends Plugin {

    public static readonly MAX_INACTIVITY_DURATION_MS: number = 10 * 60 * 1000;

    readonly name = 'rank';

    readonly minRight = -1;

    constructor(room: Room) {
        super(room);

        if (this.room) {
            setInterval(this.tick.bind(this), 60 * 1000);
        }
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
                formatted: rankHtml,
                content: striptags(rankHtml),
                user: UserController.getNeutralUser()
            }
        );
        connection.send('message', message.sanitized());
    }

    private async tick(): Promise<void> {
        // Get rooms in the session
        const sessions = Array.from(new Set(this.room.connections.map(connection => connection.session)));
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
        await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
