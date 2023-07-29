import { Connection } from '../../../skychat/Connection';
import { GlobalPlugin } from '../../GlobalPlugin';
import { Session } from '../../../skychat/Session';
import { User } from '../../../skychat/User';
import { Config } from '../../../skychat/Config';
import { BlacklistPlugin } from './BlacklistPlugin';
import { Room } from '../../../skychat/Room';
import { UserController } from '../../../skychat/UserController';


export class PrivateMessagePlugin extends GlobalPlugin {
    static readonly commandName = 'pm';

    static readonly commandAliases = ['pmadd', 'pmleave'];

    readonly minRight = Config.PREFERENCES.minRightForPrivateMessages;

    readonly rules = {
        pm: {
            minCount: 1,
            maxCount: 100,
            maxCallsPer10Seconds: 1,
            params: [{ name: 'username', pattern: /./ }]
        },
        pmadd: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{ name: 'username', pattern: User.USERNAME_REGEXP }]
        },
        pmleave: { minCount: 0, },
    };

    canManageRoom(identifier: string, room: Room): boolean {
        return room.whitelist.indexOf(identifier) !== -1;
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        switch (alias) {
        case 'pm':
            await this.handlePM(param, connection);
            break;

        case 'pmadd':
            await this.handlePMAdd(param, connection);
            break;

        case 'pmleave':
            await this.handlePMLeave(param, connection);
            break;
        }
    }

    async handlePM(param: string, connection: Connection): Promise<void> {
        const rawUsernames = param.split(' ');
        const sessions: Session[] = [];
        for (const username of rawUsernames) {
            if (! User.USERNAME_REGEXP.test(username)) {
                throw new Error(`Invalid username ${username}`);
            }
            const session = Session.getSessionByIdentifier(username.toLowerCase());
            if (! session) {
                throw new Error(`User ${username} not found`);
            }
            if (session.identifier === connection.session.identifier) {
                throw new Error('You can not send private messages to yourself');
            }
            if (BlacklistPlugin.hasBlacklisted(session.user, connection.session.user.username)) {
                throw new Error(`User ${username} has blacklisted you. You can not send him private messages`);
            }
            sessions.push(session);
        }

        if (new Set(sessions).size !== sessions.length) {
            throw new Error('You can not send multiple private messages to the same user');
        }

        const usernames = [connection.session.user.username, ...sessions.map(s => s.user.username)];
        const privateRoom = this.manager.findPrivateRoom(usernames);
        if (privateRoom) {
            // Make user join this room
            await privateRoom.attachConnection(connection);
            return;
        }

        this.manager.createPrivateRoom(usernames);
    }

    async handlePMAdd(param: string, connection: Connection): Promise<void> {
        const room = connection.room;
        if (! room) {
            throw new Error('You are not in a room');
        }
        if (! room.isPrivate) {
            throw new Error('You can not add users to a public room');
        }
        if (! this.canManageRoom(connection.session.identifier, room)) {
            throw new Error('You do not have the permission to add users to this room');
        }
        const session = Session.getSessionByIdentifier(param.toLowerCase());
        if (! session) {
            throw new Error(`User ${param} not found`);
        }
        if (session.identifier === connection.session.identifier) {
            throw new Error('You can not add yourself to a private room');
        }
        if (BlacklistPlugin.hasBlacklisted(session.user, connection.session.user.username)) {
            throw new Error(`User ${param} has blacklisted you. You can not add him to this private room`);
        }
        if (room.whitelist.indexOf(session.identifier) !== -1) {
            throw new Error(`User ${param} is already in this private room`);
        }
        room.allow(session.identifier);
        room.sendMessage({
            user: UserController.getNeutralUser(),
            content: `${session.user.username} has joined the room`,
        });
        room.whitelist
            .map(ident => Session.getSessionByIdentifier(ident))
            .filter(session => !! session)
            .forEach(session => room.manager.sendRoomList(session as Session));
    }

    async handlePMLeave(_param: string, connection: Connection): Promise<void> {
        const room = connection.room;
        if (! room) {
            throw new Error('You are not in a room');
        }
        if (! room.isPrivate) {
            throw new Error('You can not leave a public room');
        }
        if (! this.canManageRoom(connection.session.identifier, room)) {
            throw new Error('You do not have the permission to leave this room');
        }
        // Leaving room if there's others in it
        if (room.whitelist.length > 1) {
            room.unallow(connection.session.identifier);
            room.sendMessage({
                user: UserController.getNeutralUser(),
                content: `${connection.session.user.username} has left the room`,
            });
            room.manager.sendRoomList(connection);
            room.whitelist
                .map(ident => Session.getSessionByIdentifier(ident))
                .filter(session => !! session)
                .forEach(session => room.manager.sendRoomList(session as Session));
            return;
        } else {
            // Delete room
            await room.manager.deleteRoom(room.id);
            const message = UserController.createNeutralMessage({ id: 0, content: `Room ${room.id} has been deleted` });
            connection.send('message', message.sanitized());
        }
    }
}
