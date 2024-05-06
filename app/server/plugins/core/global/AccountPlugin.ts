import { Connection } from '../../../skychat/Connection.js';
import { Session } from '../../../skychat/Session.js';
import { User } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export class AccountPlugin extends GlobalPlugin {
    static readonly CHANGE_USERNAME_PRICE = 2000;

    static readonly commandName = 'account';

    static readonly commandAliases = ['set', 'resetpassword'];

    readonly minRight = 0;

    readonly rules = {
        set: {
            minCount: 2,
            coolDown: 100,
            params: [
                { name: 'field', pattern: /^(email|password)$/ },
                { name: 'value', pattern: /./ },
            ],
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (alias === 'set') {
            await this.handleSet(param, connection);
            return;
        }

        if (alias === 'resetpassword') {
            await this.handleResetPassword(param, connection);
            return;
        }
    }

    async handleSet(param: string, connection: Connection): Promise<void> {
        // Fill `field` to the first argument, and `value` with the rest of the message
        const field = param.split(' ')[0];
        const value = param.split(' ').slice(1).join(' ');
        let messageContent = `Your ${field} is now '${value}'`;

        // Handle field set
        switch (field) {
            // Email
            case 'email':
                if (!value.match(User.EMAIL_REGEXP)) {
                    throw new Error(`${value} is not a valid email`);
                }
                connection.session.user.email = value;
                await UserController.sync(connection.session.user);
                break;

            // Password
            case 'password':
                // eslint-disable-next-line no-case-declarations
                const oldPassword = value.split(' ')[0];
                // eslint-disable-next-line no-case-declarations
                const oldHashedPassword = UserController.hashPassword(
                    connection.session.user.id,
                    connection.session.user.username.toLowerCase(),
                    oldPassword,
                );
                // eslint-disable-next-line no-case-declarations
                const newPassword = value.split(' ')[1];
                if (!connection.session.user.testHashedPassword(oldHashedPassword)) {
                    throw new Error('Invalid current password');
                }
                UserController.changePassword(connection.session.user, newPassword);
                messageContent = `Your password has been changed to ${newPassword}`;
                break;

            default:
                throw new Error(`Unable to set field ${field}`);
        }

        // Send confirmation back to the user
        const message = UserController.createNeutralMessage({ content: messageContent, room: connection.roomId, id: 0 });
        connection.send('message', message.sanitized());
    }

    async handleResetPassword(param: string, connection: Connection): Promise<void> {
        const username = param.split(' ')[0].toLowerCase();
        const password = param.split(' ').slice(1).join(' ');

        if (!connection.session.isOP()) {
            throw new Error('You must be OP to reset an account password');
        }

        const session = Session.getSessionByIdentifier(username);
        if (session && session.connections.length > 0) {
            throw new Error('User must not be currently connected');
        }

        const userObject = await UserController.getUserByUsername(username);
        if (!userObject) {
            throw new Error('User does not exist');
        }

        // Change the password
        await UserController.changePassword(userObject, password);

        // Notify OP
        const message = UserController.createNeutralMessage({
            content: `${username} password has been changed to: ${password}`,
            room: connection.roomId,
            id: 0,
        });
        connection.send('message', message.sanitized());
    }

    async onNewConnection(connection: Connection): Promise<void> {
        const user = connection.session.user;
        if (user.isGuest()) {
            return;
        }

        // Send updated auth token
        connection.send('auth-token', UserController.getAuthToken(user.id));

        if (!user.email) {
            const message = UserController.createNeutralMessage({
                content: `Your email is not set!
                Use:
                /set email your@email.com
                
                To set your email address`,
                room: connection.roomId,
                id: 0,
            });
            connection.send('message', message.sanitized());
        }
    }
}
