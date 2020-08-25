import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {UserController} from "../../../UserController";
import {User} from "../../../User";


export class AccountPlugin extends Plugin {

    static readonly CHANGE_USERNAME_PRICE = 2000;

    readonly name = 'account';

    readonly aliases = ['set', 'changeusername'];

    readonly minRight = 0;

    readonly rules = {
        set: {
            minCount: 2,
            coolDown: 100,
            params: [
                {name: 'field', pattern: /^(email)$/},
                {name: 'value', pattern: /./}
            ]
        },
        changeusername: {
            minCount: 2,
            coolDown: 100,
            params: [
                {name: 'new username', pattern: User.USERNAME_LOGGED_REGEXP},
                {name: 'password', pattern: /./},
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
    }

    async handleSet(param: string, connection: Connection): Promise<void> {

        // Fill `field` to the first argument, and `value` with the rest of the message
        const field = param.split(' ')[0];
        const value = param.split(' ').slice(1).join(' ');

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

            default:
                throw new Error(`Unable to set field ${field}`);
        }

        // Send confirmation back to the user
        const message = UserController.createNeutralMessage(`Your ${field} is now '${value}'`);
        connection.send('message', message.sanitized());
    }

    async handleChangeUsername(param: string, connection: Connection): Promise<void> {

        const user = connection.session.user;
        const username = param.split(' ')[0];
        const password = param.split(' ').slice(1).join(' ');

        if (! user.testHashedPassword(UserController.hashPassword(user.id, user.username, password))) {
            throw new Error('Invalid password');
        }

        if (await UserController.getUserByUsername(username)) {
            throw new Error('This username already exists');
        }

        if (user.money < AccountPlugin.CHANGE_USERNAME_PRICE) {
            throw new Error(`You need at least ${AccountPlugin.CHANGE_USERNAME_PRICE} to change username`)
        }

        await UserController.buy(user, AccountPlugin.CHANGE_USERNAME_PRICE);

        const message = UserController.createNeutralMessage(`Your username has been changed to ${username}'`);
        connection.send('message', message.sanitized());

        await UserController.changeUsername(user.id, username, password);

        for (const conn of connection.session.connections) {
            conn.close();
        }
    }

    async onConnectionAuthenticated(connection: Connection): Promise<void> {

        const user = connection.session.user;
        if (user.email) {
            return;
        }

        const message = UserController.createNeutralMessage(`Your email is not set!
            Use:
            /set email your@email.com
            
            To set your email address`);
        connection.send('message', message.sanitized());
    }
}
