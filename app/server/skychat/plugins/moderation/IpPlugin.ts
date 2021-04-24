import {Connection} from "../../Connection";
import {User} from "../../User";
import {Session} from "../../Session";
import * as striptags from "striptags";
import {UserController} from "../../UserController";
import * as geoip from "geoip-lite";
import {MessageFormatter} from "../../MessageFormatter";
import { Plugin } from "../../Plugin";


export class IpPlugin extends Plugin {

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
                        ${formatter.getButtonHtml(connection.session.identifier, '/track username ' + connection.session.identifier, true)}
                         ${formatter.getButtonHtml('A', '/autotrack ' + connection.session.identifier, true)}
                    </td>
                    <td>${connection.origin}</td>
                    <td>${connection.userAgent}</td>
                    <td>
                        ${formatter.getButtonHtml(connection.ip, '/track ip ' + connection.ip, true)}
                         ${formatter.getButtonHtml('A', '/autotrack ' + connection.ip, true)}
                    </td>
                    <td>${geoIp ? `<a class="skychat-link" href="${geoIpLink}" rel="nofollow" target="_blank">${geoIp.country + ' / ' + geoIp.city}</a>` : ''}</td>
                </tr>`;
        }
        content += `</table>`;

        // Send the message
        const message = UserController.createNeutralMessage({content: '', room: this.room.id, id: 0});
        message.edit(striptags(content), content);
        connection.send('message', message.sanitized());
    }
}
