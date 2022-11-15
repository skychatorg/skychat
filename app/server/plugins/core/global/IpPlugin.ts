import * as geoip from 'geoip-lite';
import striptags from 'striptags';
import { Connection } from '../../../skychat/Connection';
import { User } from '../../../skychat/User';
import { Session } from '../../../skychat/Session';
import { UserController } from '../../../skychat/UserController';
import { MessageFormatter } from '../../../skychat/MessageFormatter';
import { GlobalPlugin } from '../../GlobalPlugin';
import { Config } from '../../../skychat/Config';


export class IpPlugin extends GlobalPlugin {
    static readonly commandName = 'ip';

    readonly minRight = Config.PREFERENCES.minRightForUserModeration === 'op' ? 0 : Config.PREFERENCES.minRightForUserModeration;

    readonly opOnly = Config.PREFERENCES.minRightForUserModeration === 'op';

    readonly rules = {
        ip: {
            coolDown: 1000,
            minCount: 0,
            maxCount: 1,
            params: [{ name: 'username', pattern: User.USERNAME_REGEXP }]
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const formatter = MessageFormatter.getInstance();

        // List of connections to be included
        let connections;

        // If using wildcard
        if (param === '') {
            connections = Session.connections;
        } else {
            const session = Session.getSessionByIdentifier(param);
            if (! session) {
                throw new Error('Username not found');
            }
            connections = session.connections;
        }

        // Build table containing the ips
        let content = '<table class="skychat-table">';
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
            const geoIpLink = geoIp ? `https://www.google.com/maps/place/${geoIp.ll[0]},%20${geoIp.ll[1]}` : '';
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
        content += '</table>';

        // Send the message
        const message = UserController.createNeutralMessage({ content: '', room: connection.roomId, id: 0 });
        message.edit(striptags(content), content);
        connection.send('message', message.sanitized());
    }
}
