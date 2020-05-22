import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {UserController} from "../../../UserController";
import {Message} from "../../../Message";
import {User} from "../../../User";


export class AccountPlugin extends Plugin {

    readonly name = 'account';

    readonly aliases = ['set'];

    readonly minRight = 0;

    readonly rules = {
        set: {
            minCount: 2,
            coolDown: 100,
            params: [
                {name: 'field', pattern: /^(email)$/},
                {name: 'value', pattern: /./}
            ]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (alias === 'set') {
            await this.handleSet(param, connection);
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
        const message = new Message(`Your ${field} is now '${value}'`, null, UserController.getNeutralUser());
        connection.send('message', message.sanitized());
    }

    async onConnectionAuthenticated(connection: Connection): Promise<void> {

        const user = connection.session.user;
        if (user.email) {
            return;
        }

        const message = new Message(`Your email is not set!
            Use:
            /set email your@email.com
            
            To set your email address`, null, UserController.getNeutralUser());
        connection.send('message', message.sanitized());
    }
}
