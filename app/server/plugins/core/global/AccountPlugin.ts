import { Connection } from '../../../skychat/Connection';
import { GlobalPlugin } from '../../GlobalPlugin';
import { UserController } from '../../../skychat/UserController';
import { User } from '../../../skychat/User';
import { Config } from '../../../skychat/Config';
import { Session } from '../../../skychat/Session';


export class AccountPlugin extends GlobalPlugin {

    static readonly CHANGE_USERNAME_PRICE = 2000;

    static readonly commandName = 'account';

    static readonly commandAliases = ['set', 'changeusername', 'resetpassword'];

    readonly minRight = 0;

    readonly rules = {
        set: {
            minCount: 2,
            coolDown: 100,
            params: [
                { name: 'field', pattern: /^(email|password)$/ },
                { name: 'value', pattern: /./ }
            ]
        },
        changeusername: {
            minCount: 2,
            coolDown: 100,
            params: [
                { name: 'new username', pattern: User.USERNAME_LOGGED_REGEXP },
                { name: 'password', pattern: /./ },
            ]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (alias === 'set') {
            await this.handleSet(param, connection);
            return;
        }

        if (alias === 'changeusername') {
            await this.handleChangeUsername(param, connection);
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
            if (! value.match(User.EMAIL_REGEXP)) {
                throw new Error(`${value} is not a valid email`);
            }
            connection.session.user.email = value;
            await UserController.sync(connection.session.user);
            break;

            // Password
        case 'password':
            const oldPassword = value.split(' ')[0];
            const oldHashedPassword = UserController.hashPassword(connection.session.user.id, connection.session.user.username.toLowerCase(), oldPassword);
            const newPassword = value.split(' ')[1];
            if (! connection.session.user.testHashedPassword(oldHashedPassword)) {
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

    async handleChangeUsername(param: string, connection: Connection): Promise<void> {

        const user = connection.session.user;
        const username = param.split(' ')[0];
        const password = param.split(' ').slice(1).join(' ');

        if (! user.testHashedPassword(UserController.hashPassword(user.id, user.username, password))) {
            throw new Error('Invalid password');
        }

        if (! connection.session.isOP() && Config.isInOPList(username)) {
            throw new Error('You can not escalate yourself into OP by changing username. Please remove the new username from the OP list, change username, then re-add it.');
        }

        if (await UserController.getUserByUsername(username)) {
            throw new Error('This username already exists');
        }

        if (user.money < AccountPlugin.CHANGE_USERNAME_PRICE) {
            throw new Error(`You need at least ${AccountPlugin.CHANGE_USERNAME_PRICE} to change username`);
        }

        await UserController.buy(user, AccountPlugin.CHANGE_USERNAME_PRICE);

        const message = UserController.createNeutralMessage({ content: `Your username has been changed to ${username}`, room: connection.roomId, id: 0 });
        connection.send('message', message.sanitized());

        await UserController.changeUsername(user, username, password);
        connection.session.identifier = user.username.toLowerCase();
    }

    async handleResetPassword(param: string, connection: Connection): Promise<void> {

        const username = param.split(' ')[0].toLowerCase();
        const password = param.split(' ').slice(1).join(' ');

        if (! connection.session.isOP()) {
            throw new Error('You must be OP to reset an account password');
        }

        const session = Session.getSessionByIdentifier(username);
        if (session && session.connections.length > 0) {
            throw new Error('User must not be currently connected');
        }

        const userObject = await UserController.getUserByUsername(username);
        if (! userObject) {
            throw new Error('User does not exist');
        }

        // Change the password
        await UserController.changePassword(userObject, password);

        // Notify OP
        const message = UserController.createNeutralMessage({ content: `${username} password has been changed to: ${password}`, room: connection.roomId, id: 0 });
        connection.send('message', message.sanitized());
    }

    async onConnectionAuthenticated(connection: Connection): Promise<void> {

        const user = connection.session.user;
        if (user.email) {
            return;
        }

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
