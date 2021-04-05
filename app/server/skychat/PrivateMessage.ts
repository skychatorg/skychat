import {SanitizedUser, User} from "./User";
import {Message, MessageConstructorOptions, SanitizedMessage} from "./Message";

export interface SanitizedPrivateMessage extends SanitizedMessage {

    to: SanitizedUser;
}

export interface PrivateMessageConstructorOptions extends MessageConstructorOptions {
    to: User;
}


export class PrivateMessage extends Message {

    private readonly to: User;

    constructor(options: PrivateMessageConstructorOptions) {
        // Always set the id to 0 as private messages are never saved in the database
        super({...options, id: 0});

        this.to = options.to;
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
