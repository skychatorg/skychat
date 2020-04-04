import {SanitizedUser, User} from "./User";
import {StickerManager} from "./StickerManager";

export type SanitizedMessage = {

    /**
     * Message content
     */
    content: string;

    /**
     * Message content, formatted as html
     */
    formatted: string;

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

    public readonly formatted: string;

    public readonly user: User;

    public readonly createdTime: Date;

    constructor(content: string, connection: User, createdTime?: Date) {

        this.content = content;
        this.formatted = StickerManager.getInstance().format(content);
        this.user = connection;
        this.createdTime = typeof createdTime !== 'undefined' ? createdTime : new Date();
    }

    /**
     *
     */
    public sanitized(): SanitizedMessage {
        return {
            content: this.content,
            formatted: this.formatted,
            user: this.user.sanitized(),
            createdTimestamp: this.createdTime.getTime() * 0.001
        };
    }
}
