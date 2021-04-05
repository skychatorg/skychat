import {Command} from "../../Command";
import {Connection} from "../../../Connection";
import {User} from "../../../User";
import {Session} from "../../../Session";
import {Message} from "../../../Message";
import * as striptags from "striptags";
import {UserController} from "../../../UserController";
import * as geoip from "geoip-lite";
import {MessageFormatter} from "../../../MessageFormatter";


export class IpPlugin extends Command {

    readonly name = 'ip';

    readonly minRight = 40;

    readonly rules = {
        ip: {
            coolDown: 1000,
            minCount: 0,
            maxCount: 1,
            params: [{name: 'username', pattern: User.USERNAME_REGEXP}]
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const formatter = MessageFormatter.getInstance();

        // List of connections to be included
        let connections;

        // If using wildcard
        if (param === '') {
            connections = this.room.connections;

        } else {
            const username = Session.autocompleteIdentifier(param);
            const session = Session.getSessionByIdentifier(username);
            if (! session) {
                throw new Error('Username not found');
            }
            connections = session.connections;
        }

        // Build table containing the ips
        let content = `<table class="skychat-table">`;
        content += `
            <tr>
                <th>room</th>
                <th>username</th>
                <th>origin</th>
                <th>browser</th>
                <th>ip</th>
                <th>geoip</th>
            </tr>
        `;
        for (const connection of connections) {
            const roomId = connection.room ? connection.room.id : 'none';
            const geoIp: geoip.Lookup | null = geoip.lookup(connection.ip);
            const geoIpLink = geoIp ? `https://www.google.com/maps/place/${geoIp.ll[0]},%20${geoIp.ll[1]}` : ``;
            content += `
                <tr>
                    <td>${roomId}</td>
                    <td>
                        ${formatter.getButtonHtml(connection.session.identifier, '/track username ' + connection.session.identifier, true, true)}
                         ${formatter.getButtonHtml('A', '/autotrack ' + connection.session.identifier, true, true)}
                    </td>
                    <td>${connection.origin}</td>
                    <td>${connection.userAgent}</td>
                    <td>
                        ${formatter.getButtonHtml(connection.ip, '/track ip ' + connection.ip, true, true)}
                         ${formatter.getButtonHtml('A', '/autotrack ' + connection.ip, true, true)}
                    </td>
                    <td>${geoIp ? `<a class="skychat-link" href="${geoIpLink}" rel="nofollow" target="_blank">${geoIp.country + ' / ' + geoIp.city}</a>` : ''}</td>
                </tr>`;
        }
        content += `</table>`;

        // Send the message
        const message = UserController.createNeutralMessage({content: '', id: 0});
        message.edit(striptags(content), content);
        connection.send('message', message.sanitized());
    }
}
