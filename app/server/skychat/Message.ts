import {SanitizedUser, User} from "./User";
import {StickerManager} from "./StickerManager";

export type SanitizedMessage = {

    /**
     * Message unique id
     */
    id: number;

    /**
     * Message content
     */
    content: string;

    /**
     * Message content, formatted as html
     */
    formatted: string;

    /**
     * Quoted message if any
     */
    quoted: SanitizedMessage | null;

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

    public static ID: number = 1;

    public readonly id: number;

    public readonly content: string;

    public readonly formatted: string;

    public readonly quoted: Message | null;

    public readonly user: User;

    public readonly createdTime: Date;

    constructor(content: string, user: User, quoted?: Message | null, createdTime?: Date) {

        this.id = ++ Message.ID;
        this.content = content;
        this.formatted = StickerManager.getInstance().format(content);
        this.quoted = quoted || null;
        this.user = user;
        this.createdTime = typeof createdTime !== 'undefined' ? createdTime : new Date();
    }

    /**
     *
     */
    public sanitized(quoteDepth: number = 2): SanitizedMessage {
        return {
            id: this.id,
            content: this.content,
            quoted: this.quoted && quoteDepth > 0 ? this.quoted.sanitized(quoteDepth - 1) : null,
            formatted: this.formatted,
            user: this.user.sanitized(),
            createdTimestamp: this.createdTime.getTime() * 0.001
        };
    }
}
