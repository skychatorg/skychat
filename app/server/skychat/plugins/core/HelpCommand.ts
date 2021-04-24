import {PluginCommandRules} from "../../Plugin";
import {Plugin} from "../../Plugin";
import {Connection} from "../../Connection";
import * as striptags from "striptags";
import {Config} from "../../Config";
import {UserController} from "../../UserController";


export class HelpCommand extends Plugin {

    readonly name = 'help';

    readonly minRight = -1;

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Group commands by main name
        const commandAliases = Object.keys(this.room.commands);
        let content = `<table class="skychat-table">`;
        content += `
            <tr>
                <th>name</th>
                <th>min right</th>
                <th>cooldown</th>
                <th>params</th>
            </tr>    
        `;
        for (let alias of commandAliases) {
            const command = this.room.commands[alias];

            // If user has not the right to access the command, hide it
            if (connection.session.user.right < command.minRight) {
                continue;
            }
            if (command.opOnly && ! Config.isOP(connection.session.identifier)) {
                continue;
            }

            // If command is not callable
            if (! command.callable || command.hidden) {
                continue;
            }

            // Get rule object
            const rules: PluginCommandRules = (command.rules && command.rules[alias]) ? command.rules[alias] : {};

            content += `
            <tr>
                <td>${alias}</td>
                <td>${command.minRight}</td>
                <td>${((rules.coolDown || 0) / 1000) || 0}s</td>
                <td>${(rules.params || []).map((param: any) => param.name).join(', ')}</td>
            </tr>            
            `;
        }
        content += `</table>`;
        const message = UserController.createNeutralMessage({content, room: this.room.id, id: 0});
        message.edit(striptags(content), content);
        connection.send('message', message.sanitized());
    }
}
