import {SanitizedUser, User} from "./User";
import {MessageFormatter} from "./MessageFormatter";

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

    public content: string;

    public formatted: string;

    public readonly quoted: Message | null;

    public readonly user: User;

    public readonly createdTime: Date;

    constructor(content: string, user: User, quoted?: Message | null, createdTime?: Date) {

        this.id = ++ Message.ID;
        this.content = content;
        this.formatted = MessageFormatter.getInstance().format(content);
        this.quoted = quoted || null;
        this.user = user;
        this.createdTime = typeof createdTime !== 'undefined' ? createdTime : new Date();
    }

    /**
     * Append raw text to the message
     * @param content
     * @param formatted If set, will not be built from the content
     */
    public append(content: string, formatted?: string) {
        this.content += "\n" + content;
        this.formatted += formatted ? formatted : ("<br>\n" + MessageFormatter.getInstance().format(content));
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
