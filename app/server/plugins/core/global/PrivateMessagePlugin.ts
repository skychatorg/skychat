import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { Room } from '../../../skychat/Room.js';
import { Session } from '../../../skychat/Session.js';
import { User } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { BlacklistPlugin } from './BlacklistPlugin.js';

export class PrivateMessagePlugin extends GlobalPlugin {
    static readonly commandName = 'pm';

    static readonly commandAliases = ['pmadd', 'pmleave', 'pmremove'];

    readonly minRight = Config.PREFERENCES.minRightForPrivateMessages;

    readonly rules = {
        pm: {
            minCount: 1,
            maxCount: 100,
            maxCallsPer10Seconds: 1,
            params: [{ name: 'username', pattern: /./ }],
        },
        pmadd: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{ name: 'username', pattern: User.USERNAME_REGEXP }],
        },
        pmleave: { minCount: 0 },
        pmremove: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{ name: 'username', pattern: User.USERNAME_REGEXP }],
        },
    };

    canManageRoom(identifier: string, room: Room): boolean {
        return room.whitelist.indexOf(identifier) !== -1;
    }

    /**
     * Removes a user from a private room and handles cleanup
     * @param room The private room to remove the user from
     * @param userIdentifier The identifier of the user to remove
     * @param removalMessage The message to send to the room about the removal
     * @param notifyRemovedUser Whether to send room list update to the removed user's connection
     */
    private async removeUserFromPrivateRoom(
        room: Room,
        userIdentifier: string,
        removalMessage: string,
        notifyRemovedUser: boolean = false,
    ): Promise<void> {
        // Remove user from room
        room.unallow(userIdentifier);

        // Send notification message to the room
        room.sendMessage({
            user: UserController.getNeutralUser(),
            content: removalMessage,
        });

        // Update room list for the removed user if requested
        if (notifyRemovedUser) {
            const removedSession = Session.getSessionByIdentifier(userIdentifier);
            if (removedSession) {
                room.manager.sendRoomList(removedSession);
            }
        }

        // Update room list for all remaining users
        room.whitelist
            .map((ident) => Session.getSessionByIdentifier(ident))
            .filter((session) => !!session)
            .forEach((session) => room.manager.sendRoomList(session as Session));

        // If the room is now empty, delete it
        if (room.whitelist.length === 0) {
            await room.manager.deleteRoom(room.id);
        }
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

            case 'pmremove':
                await this.handlePMRemove(param, connection);
                break;
        }
    }

    async handlePM(param: string, connection: Connection): Promise<void> {
        const rawUsernames = param.split(' ');
        const sessions: Session[] = [];
        for (const username of rawUsernames) {
            if (!User.USERNAME_REGEXP.test(username)) {
                throw new Error(`Invalid username ${username}`);
            }
            const session = Session.getSessionByIdentifier(username.toLowerCase());
            if (!session) {
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

        const usernames = [connection.session.user.username, ...sessions.map((s) => s.user.username)];
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
        if (!room) {
            throw new Error('You are not in a room');
        }
        if (!room.isPrivate) {
            throw new Error('You can not add users to a public room');
        }
        if (!this.canManageRoom(connection.session.identifier, room)) {
            throw new Error('You do not have the permission to add users to this room');
        }
        const session = Session.getSessionByIdentifier(param.toLowerCase());
        if (!session) {
            throw new Error(`User ${param} not found`);
        }
        if (session.identifier === connection.session.identifier) {
            throw new Error('You can not add yourself to a private room');
        }
        if (BlacklistPlugin.hasBlacklisted(session.user, connection.session.user.username)) {
            throw new Error(`User ${session.user.username} has blacklisted you. You can not add him to this private room`);
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
            .map((ident) => Session.getSessionByIdentifier(ident))
            .filter((session) => !!session)
            .forEach((session) => room.manager.sendRoomList(session as Session));
    }

    async handlePMLeave(_param: string, connection: Connection): Promise<void> {
        const room = connection.room;
        if (!room) {
            throw new Error('You are not in a room');
        }
        if (!room.isPrivate) {
            throw new Error('You can not leave a public room');
        }
        if (!this.canManageRoom(connection.session.identifier, room)) {
            throw new Error('You do not have the permission to leave this room');
        }

        // If leaving room and there are others in it, use the utility function
        if (room.whitelist.length > 1) {
            await this.removeUserFromPrivateRoom(
                room,
                connection.session.identifier,
                `${connection.session.user.username} has left the room`,
                true,
            );
        } else {
            // Delete room if it's the last user
            await room.manager.deleteRoom(room.id);
            const message = UserController.createNeutralMessage({ id: 0, content: `Room ${room.id} has been deleted` });
            connection.send('message', message.sanitized());
        }
    }

    async handlePMRemove(param: string, connection: Connection): Promise<void> {
        const room = connection.room;
        if (!room) {
            throw new Error('You are not in a room');
        }
        if (!room.isPrivate) {
            throw new Error('You can not remove users from a public room');
        }
        if (!this.canManageRoom(connection.session.identifier, room)) {
            throw new Error('You do not have the permission to remove users from this room');
        }
        const session = Session.getSessionByIdentifier(param.toLowerCase());
        if (!session) {
            throw new Error(`User ${param} not found`);
        }
        if (session.identifier === connection.session.identifier) {
            throw new Error('You can not remove yourself from a private room. Use /pmleave instead');
        }
        if (room.whitelist.indexOf(session.identifier) === -1) {
            throw new Error(`User ${param} is not in this private room`);
        }

        await this.removeUserFromPrivateRoom(room, session.identifier, `${session.user.username} has been removed from the room`);
    }
}
