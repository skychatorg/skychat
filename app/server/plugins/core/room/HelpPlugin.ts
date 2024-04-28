import { Plugin, PluginCommandRules } from '../../Plugin.js';
import { RoomPlugin } from '../../RoomPlugin.js';
import { Connection } from '../../../skychat/Connection.js';
import striptags from 'striptags';
import { UserController } from '../../../skychat/UserController.js';

export class HelpPlugin extends RoomPlugin {
    static readonly commandName = 'help';

    readonly minRight = -1;

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        // Group commands by main name
        const commandAliases: [string, Plugin][] = (Object.entries(this.room.commands) as [string, Plugin][]).concat(
            Object.entries(this.room.manager.commands),
        );
        let content = '<table class="skychat-table">';
        content += `
            <tr>
                <th>name</th>
                <th>min right</th>
                <th>cooldown</th>
                <th>params</th>
            </tr>    
        `;
        for (const [alias, command] of commandAliases) {
            // If user has not the right to access the command, hide it
            if (connection.session.user.right < command.minRight) {
                continue;
            }
            if (command.opOnly && !connection.session.isOP()) {
                continue;
            }

            // If command is not callable
            if (!command.callable || command.hidden) {
                continue;
            }

            // Get rule object
            const rules: PluginCommandRules = command.rules && command.rules[alias] ? command.rules[alias] : {};
            const coolDown = Array.isArray(rules.coolDown) ? rules.coolDown.toString() : (rules.coolDown ?? 0) / 1000;

            content += `
            <tr>
                <td>${alias}</td>
                <td>${command.minRight}</td>
                <td>${coolDown}s</td>
                <td>${(rules.params ?? []).map((param) => param.name).join(', ')}</td>
            </tr>            
            `;
        }
        content += '</table>';
        const message = UserController.createNeutralMessage({ content, room: this.room.id, id: 0 });
        message.edit(striptags(content), content);
        connection.send('message', message.sanitized());
    }
}
