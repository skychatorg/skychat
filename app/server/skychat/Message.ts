import {Connection} from "./Connection";
import {Session} from "./Session";
import {SanitizedUser, User} from "./User";

export type SanitizedMessage = {

    /**
     * Message content
     */
    content: string;

    /**
     * Author
     */
    user: SanitizedUser;

    /**
     * Timestamp in seconds
     */
    createdTimestamp: number;
};


export class Message {

    public readonly content: string;

    public readonly user: User;

    public readonly createdTime: Date;

    constructor(content: string, connection: User, createdTime?: Date) {

        this.content = content;
        this.user = connection;
        this.createdTime = typeof createdTime !== 'undefined' ? createdTime : new Date();
    }

    /**
     *
     */
    public sanitized(): SanitizedMessage {
        return {
            content: this.content,
            user: this.user.sanitized(),
            createdTimestamp: this.createdTime.getTime() * 0.001
        };
    }
}
