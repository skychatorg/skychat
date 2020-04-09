import {Command} from "../Command";
import {Connection} from "../../Connection";
import {User} from "../../User";
import {Session} from "../../Session";
import {Message} from "../../Message";
import * as striptags from "striptags";


export class IpPlugin extends Command {

    readonly name = 'ip';

    readonly minRight = 100;

    readonly rules = {
        ip: {
            coolDown: 10000,
            minCount: 1,
            maxCount: 1,
            params: [{name: 'username', pattern: User.USERNAME_REGEXP}]
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const username = Session.autocompleteIdentifier(param);
        const session = Session.getSessionByIdentifier(username);
        if (! session) {
            throw new Error('Username not found');
        }
        let content = `<table class="skychat-table">`;
        content += `
            <tr>
                <th>room</th>
                <th>origin</th>
                <th>browser</th>
                <th>ip</th>
            </tr>
        `;
        for (const connection of session.connections) {
            const roomId = connection.room ? connection.room.id : 'none';
            const origin = connection.request.headers['origin'] || '';
            const userAgent = connection.userAgent;
            const ip = connection.request.connection.remoteAddress;
            content += `
                <tr>
                    <td>${roomId}</td>
                    <td>${origin}</td>
                    <td>${userAgent}</td>
                    <td>${ip}</td>
                </tr>`;
        }
        content += `</table>`;
        const message = new Message('', User.BOT_USER);
        message.edit(striptags(content), content);
        connection.send('message', message.sanitized());
    }
}
