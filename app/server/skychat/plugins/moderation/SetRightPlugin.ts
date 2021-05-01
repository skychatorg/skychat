import {Connection} from "../../Connection";
import {User} from "../../User";
import {Session} from "../../Session";
import {ConnectedListPlugin} from "../core/ConnectedListPlugin";
import {UserController} from "../../UserController";
import {GlobalPlugin} from "../../GlobalPlugin";


export class SetRightPlugin extends GlobalPlugin {

    static readonly commandName = 'setright';

    readonly minRight = 0;

    readonly rules = {
        setright: {
            minCount: 2,
            maxCount: 2,
            params: [
                {name: "username", pattern: User.USERNAME_LOGGED_REGEXP},
                {name: "right", pattern: /^([0-9]+)$/},
            ]
        }
    };

    readonly opOnly = true;

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        let [usernameRaw, rightRaw] = param.split(' ');
        const username = Session.autocompleteIdentifier(usernameRaw);
        const right = parseInt(rightRaw);

        const session = Session.getSessionByIdentifier(username);
        if (! session) {
            throw new Error('User not found');
        }

        const user = session.user;
        user.right = right;
        await UserController.sync(user);
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
