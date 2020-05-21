import {Command} from "../../Command";
import {Connection} from "../../../Connection";
import {User} from "../../../User";
import {Session} from "../../../Session";
import {Message} from "../../../Message";
import * as striptags from "striptags";
import {UserController} from "../../../UserController";


export class IpPlugin extends Command {

    readonly name = 'ip';

    readonly minRight = 30;

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
        let content = `<p>List of ${session.identifier}'s connections:</p>`;
        content += `<table class="skychat-table">`;
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
            content += `
                <tr>
                    <td>${roomId}</td>
                    <td>${connection.origin}</td>
                    <td>${connection.userAgent}</td>
                    <td>${connection.ip}</td>
                </tr>`;
        }
        content += `</table>`;
        const message = new Message('', null, UserController.getNeutralUser());
        message.edit(striptags(content), content);
        connection.send('message', message.sanitized());
    }
}
