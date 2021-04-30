import {Connection} from "../../Connection";
import {RoomPlugin} from "../../RoomPlugin";
import { UserController } from "../../UserController";
import { Config } from "../../Config";


export class RoomManagerPlugin extends RoomPlugin {

    static readonly commandName = 'room';

    static readonly commandAliases = ['roomset', 'roomcreate', 'roomdelete', 'roomplugin']

    readonly opOnly = true;

    readonly rules = {
        room: { },
        roomset: {
            minCount: 2,
            params: [
                {name: 'property', pattern: /^(name)$/},
                {name: 'value', pattern: /.?/},
            ]
        },
        roomcreate: {
            minCount: 2,
            params: [
                {name: 'new room id', pattern: /^([0-9]+)$/},
                {name: 'name', pattern: /.+/},
            ]
        },
        roomdelete: {maxCount: 0,},
        roomplugin: {
            minCount: 1,
            maxCount: 1,
            params: [
                {name: 'plugin', pattern: /^(\+|\-)([A-Za-z0-9]+)$/},
            ]
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        switch (alias) {

            case 'roomset':
                await this.handleRoomSet(param, connection);
                break;

            case 'roomcreate':
                await this.handleRoomCreate(param, connection);
                break;

            case 'roomdelete':
                await this.handleRoomDelete(param, connection);
                break;

            case 'roomplugin':
                await this.handleRoomPlugin(param, connection);
                break;
        }
    }

    async handleRoomSet(param: string, connection: Connection): Promise<void> {
        const property = param.substr(0, param.indexOf(' '));
        const value = param.substr(param.indexOf(' ') + 1).trim();
        
        switch (property) {

            case 'name':
                this.room.name = value;
                break;
            
            default:
                throw new Error(`Invalid property ${property}`);
        }
        const message = UserController.createNeutralMessage({ content: `Room property ${property} set to ${value}` });
        connection.send('message', message.sanitized());
    }

    async handleRoomCreate(param: string, connection: Connection): Promise<void> {
        const roomId = parseInt(param.substr(0, param.indexOf(' ')));
        const roomName = param.substr(param.indexOf(' ') + 1).trim();
        if (isNaN(roomId)) {
            throw new Error('Invalid room id');
        }
        const room = this.room.manager.createRoom(roomId, roomName);
        const message = UserController.createNeutralMessage({ content: `Room ${room.id} has been created` });
        connection.send('message', message.sanitized());
    }

    async handleRoomDelete(param: string, connection: Connection): Promise<void> {
        await this.room.manager.deleteRoom(this.room.id);
        const message = UserController.createNeutralMessage({ content: `Room ${this.room.id} has been deleted` });
        connection.send('message', message.sanitized());
    }

    async handleRoomPlugin(param: string, connection: Connection): Promise<void> {
        const add = param[0] === '+';
        const pluginName = param.substr(1);
        
        // Add a plugin
        if (add) {
            if (Config.PREFERENCES.plugins.indexOf(pluginName) === -1) {
                throw new Error(`Plugin ${pluginName} does not exist. Is it in the preferences.json file?`);
            }
            if (this.room.enabledPlugins.indexOf(pluginName) !== -1) {
                throw new Error(`Plugin ${pluginName} is already enabled`);
            }
            this.room.enabledPlugins.push(pluginName);
            const message = UserController.createNeutralMessage({ content: `Plugin ${pluginName} has been enabled` });
            connection.send('message', message.sanitized());
            return;
        }

        // Remove a plugin
        if (this.room.enabledPlugins.indexOf(pluginName) === -1) {
            throw new Error(`Unable to disable plugin ${pluginName} because it is not currently enabled in this room`);
        }
        this.room.enabledPlugins = this.room.enabledPlugins.filter(name => name !== pluginName);
        const message = UserController.createNeutralMessage({ content: `Plugin ${pluginName} has been disabled` });
        connection.send('message', message.sanitized());
        return;
    }
}
