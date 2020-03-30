import {Connection} from "../generic-server/Connection";
import {SkyChatSession} from "./SkyChatSession";
import {Command} from "./Command";
import {Plugin} from "./Plugin";
const requireDir = require('require-dir');


export class MessageHandler {

    public static commands: {[commandName: string]: Command};

    public static plugins: Plugin[];

    /**
     * Load the available commands
     */
    public static initialize() {
        const classes = requireDir('./commands', {cache: false});
        MessageHandler.commands = {};
        MessageHandler.plugins = [];
        Object.keys(classes).forEach(ClassName => {
            const ClassConstructor = classes[ClassName][ClassName];
            const command = new ClassConstructor();
            MessageHandler.commands[command.name] = command;
            if (command instanceof Plugin) {
                MessageHandler.plugins.push(command);
            }
            command.aliases.forEach((alias: any) => {
                MessageHandler.commands[alias] = command;
            })
        });
    }

    /**
     * Handle a sent message
     * @param message
     * @param connection
     */
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
        const command = MessageHandler.commands[commandName];
        if (! command) {
            throw new Error('This command does not exist');
        }

        await command.execute(commandName, param, connection);
    }
}


MessageHandler.initialize();
