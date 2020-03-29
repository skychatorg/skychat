import {Connection} from "../generic-server/Connection";
import {SkyChatSession} from "./SkyChatSession";
import {SkyChatCommand} from "./SkyChatCommand";
const requireDir = require('require-dir');


export class SkyChatMessageHandler {

    public static commands: {[commandName: string]: SkyChatCommand};

    public static initialize() {
        const classes = requireDir('./commands', {cache: false});
        SkyChatMessageHandler.commands = {};
        Object.keys(classes).forEach(ClassName => {
            const ClassConstructor = classes[ClassName][ClassName];
            const command = new ClassConstructor() as SkyChatCommand;
            SkyChatMessageHandler.commands[command.name] = command;
            command.aliases.forEach(alias => {
                SkyChatMessageHandler.commands[alias] = command;
            })
        });
    }

    public static async handleMessage(message: string, connection: Connection<SkyChatSession>) {

        message = message.trim();
        if (message.length === 0) {
            throw new Error('Empty message');
        }

        if (message[0] !== '/') {
            message = '/message ' + message;
        }

        // Command name
        const commandName = message.split(' ')[0].substr(1).toLowerCase();

        // Command params (everything after '/command ')
        const param = message.substr(commandName.length + 2);

        // Find command object
        const command = SkyChatMessageHandler.commands[commandName];
        if (! command) {
            throw new Error('This command does not exist');
        }

        await command.execute(param, connection);
    }
}


SkyChatMessageHandler.initialize();
