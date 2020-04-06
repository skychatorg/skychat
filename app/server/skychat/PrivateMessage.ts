import {SanitizedUser, User} from "./User";
import {Message, SanitizedMessage} from "./Message";

export interface SanitizedPrivateMessage extends SanitizedMessage {

    to: SanitizedUser;
}


export class PrivateMessage extends Message {

    private readonly to: User;

    constructor(content: string, from: User, to: User) {
        super(content, from, null);

        this.to = to;
    }

    /**
     * @override
     * @param quoteDepth
     */
    public sanitized(quoteDepth: number = 2): SanitizedPrivateMessage {
        return {
            ...super.sanitized(2),
            to: this.to.sanitized()
        };
    }
}
