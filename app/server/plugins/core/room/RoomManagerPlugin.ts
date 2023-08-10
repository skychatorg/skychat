import { Connection } from '../../../skychat/Connection';
import { RoomPlugin } from '../../RoomPlugin';
import { UserController } from '../../../skychat/UserController';
import { Room } from '../../../skychat/Room';
import { Session } from '../../../skychat/Session';

export class RoomManagerPlugin extends RoomPlugin {
    static readonly commandName = 'room';

    static readonly commandAliases = ['roomset', 'roomcreate', 'roomdelete'];

    readonly rules = {
        room: {},
        roomcreate: {
            minCount: 0,
            params: [{ name: 'name', pattern: /.+/ }],
        },
        roomset: {
            minCount: 2,
            params: [
                { name: 'property', pattern: /^(name)$/ },
                { name: 'value', pattern: /.?/ },
            ],
        },
        roomdelete: { maxCount: 0 },
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

        switch (property) {
            case 'name':
                this.room.name = value;
                break;

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
}
