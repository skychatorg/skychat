import { Connection } from '../../../skychat/Connection.js';
import { Logging } from '../../../skychat/Logging.js';
import { Room } from '../../../skychat/Room.js';
import { Session } from '../../../skychat/Session.js';
import { UserController } from '../../../skychat/UserController.js';
import { RoomPlugin } from '../../RoomPlugin.js';
import { RoomProtectPlugin } from '../../security_extra/RoomProtectPlugin.js';

export class RoomManagerPlugin extends RoomPlugin {
    static readonly commandName = 'room';

    static readonly commandAliases = ['roomset', 'roomcreate', 'roomdelete', 'roomorder'];

    readonly rules = {
        room: {},
        roomcreate: {
            minCount: 0,
            params: [{ name: 'name', pattern: /.+/ }],
        },
        roomset: {
            minCount: 2,
            params: [
                { name: 'property', pattern: /^(name|main)$/ },
                { name: 'value', pattern: /.?/ },
            ],
        },
        roomdelete: { maxCount: 0 },
        roomorder: {
            minCount: 1,
            params: [{ name: 'offset', pattern: /^\d+(,\d+)*$/ }],
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

            case 'roomorder':
                await this.handleRoomOrder(param, connection);
                break;
        }
    }

    async handleRoomCreate(param: string, connection: Connection): Promise<void> {
        if (!connection.session.isOP()) {
            throw new Error('Only OP can create public rooms');
        }
        const roomName = param.trim();
        const room = this.room.manager.createRoom(roomName);
        const message = UserController.createNeutralMessage({ id: 0, content: `Room ${room.id} has been created` });
        connection.send('message', message.sanitized());
    }

    canManageRoom(session: Session, room: Room): boolean {
        if (room.isPrivate) {
            return room.whitelist.indexOf(session.identifier) !== -1;
        } else {
            return session.isOP();
        }
    }

    async handleRoomSet(param: string, connection: Connection): Promise<void> {
        if (!this.canManageRoom(connection.session, this.room)) {
            throw new Error('You do not have the permission to modify this room');
        }
        const property = param.substr(0, param.indexOf(' '));
        const value = param.substr(param.indexOf(' ') + 1).trim();
        Logging.info('Setting room property', property, 'to', value, 'for', this.room.id);

        switch (property) {
            case 'name':
                this.room.name = value;
                break;

            case 'main': {
                if (value !== 'true') {
                    throw new Error('Use /roomset main true to set this room as main. To change main room, run this command in another room.');
                }

                // Validate: must be a public room
                if (this.room.isPrivate) {
                    throw new Error('Only public rooms can be set as the main room');
                }

                // Unset any existing main room
                for (const room of this.room.manager.rooms) {
                    if (room.main && room.id !== this.room.id) {
                        room.main = false;
                        Logging.info('Unsetting main for room', room.id);
                    }
                }

                // Auto-disable RoomProtect if enabled
                const roomProtectPlugin = this.room.getPlugin<RoomProtectPlugin>(RoomProtectPlugin.commandName);
                if (roomProtectPlugin && roomProtectPlugin.getMinRight() > -1) {
                    roomProtectPlugin.disableProtection();
                    Logging.info('Auto-disabled RoomProtect for main room', this.room.id);
                }

                Logging.info('Setting main to true for', this.room.id);
                this.room.main = true;
                break;
            }

            default:
                throw new Error(`Invalid property ${property}`);
        }
        Object.values(Session.sessions).forEach((session) => this.room.manager.sendRoomList(session));
        const message = UserController.createNeutralMessage({ id: 0, content: `Room property ${property} set to ${value}` });
        connection.send('message', message.sanitized());
    }

    async handleRoomDelete(param: string, connection: Connection): Promise<void> {
        if (this.room.isPrivate) {
            throw new Error('Use pmleave instead');
        }
        if (!this.canManageRoom(connection.session, this.room)) {
            throw new Error('You do not have the permission to delete this room');
        }
        await this.room.manager.deleteRoom(this.room.id);
        const message = UserController.createNeutralMessage({ id: 0, content: `Room ${this.room.id} has been deleted` });
        connection.send('message', message.sanitized());
    }

    async handleRoomOrder(param: string, connection: Connection): Promise<void> {
        if (!connection.session.isOP()) {
            throw new Error('Only OP can reorder rooms');
        }
        const order = param.split(',').map((offset) => parseInt(offset));
        await this.room.manager.reOrderRooms(order);
        const message = UserController.createNeutralMessage({ id: 0, content: `Room have been reordered` });
        connection.send('message', message.sanitized());
    }
}
