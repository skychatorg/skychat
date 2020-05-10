import {SanitizedUser, User} from "./User";
import {MessageFormatter} from "./MessageFormatter";

export interface SanitizedMessage {

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

    /**
     * Message metadata
     */
    meta: MessageMeta;
}

export type MessageMeta = {
    device: string
}


export class Message {

    public static ID: number = 1;

    public readonly id: number;

    public content: string;

    public formatted: string;

    public readonly quoted: Message | null;

    public readonly user: User;

    public readonly createdTime: Date;

    public readonly meta: MessageMeta;

    constructor(content: string, formatted: string | null, user: User, quoted?: Message | null, createdTime?: Date, meta?: Partial<MessageMeta>) {

        this.id = ++ Message.ID;
        this.content = content;
        this.formatted = typeof formatted === 'string' ? formatted : MessageFormatter.getInstance().format(content);
        this.quoted = quoted || null;
        this.user = user;
        this.createdTime = typeof createdTime !== 'undefined' ? createdTime : new Date();
        this.meta = Object.assign({
            device: ''
        }, meta || {});
    }

    /**
     * Edit a message content
     * @param content
     * @param formatted
     */
    public edit(content: string, formatted?: string) {
        this.content = content;
        this.formatted = formatted ? formatted : (MessageFormatter.getInstance().format(content));
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
     * Get the number of lines of the message
     */
    public getLineCount(): number {
        return this.content.split("\n").length;
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
            createdTimestamp: this.createdTime.getTime() * 0.001,
            meta: this.meta
        };
    }
}
