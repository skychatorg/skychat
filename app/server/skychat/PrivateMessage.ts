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
        super(options);

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
