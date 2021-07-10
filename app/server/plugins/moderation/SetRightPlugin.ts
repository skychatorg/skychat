import {Connection} from "../../skychat/Connection";
import {User} from "../../skychat/User";
import {Session} from "../../skychat/Session";
import {ConnectedListPlugin} from "../core/ConnectedListPlugin";
import {UserController} from "../../skychat/UserController";
import {GlobalPlugin} from "../../skychat/GlobalPlugin";


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
        const identifier = usernameRaw.toLowerCase();
        const right = parseInt(rightRaw);

        const session = Session.getSessionByIdentifier(identifier);
        if (! session) {
            throw new Error('User not found');
        }

        const user = session.user;
        user.right = right;
        await UserController.sync(user);
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
