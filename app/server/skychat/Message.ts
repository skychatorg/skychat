import {SanitizedUser, User} from "./User";
import {MessageFormatter} from "./MessageFormatter";

export interface SanitizedMessage {

    /**
     * Message unique id
     */
    id: number;

    /**
     * Message room
     */
    room: number | null;

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

    device: string;

    audio: number;
}


export type MessageConstructorOptions = {
    id?: number;
    room?: number;
    content: string;
    formatted?: string | null;
    user: User;
    quoted?: Message | null;
    createdTime?: Date | null;
    meta?: Partial<MessageMeta> | null;
}

export class Message {

    public static ID: number = 1;

    public readonly id: number;

    public readonly room: number | null;

    public content: string;

    public formatted: string;

    public readonly quoted: Message | null;

    public readonly user: User;

    public readonly createdTime: Date;

    public readonly meta: MessageMeta;

    constructor(options: MessageConstructorOptions) {
        this.id = typeof options.id !== 'undefined' ? options.id : ++ Message.ID;
        this.room = typeof options.room === 'number' ? options.room : null;
        this.content = options.content;
        this.formatted = typeof options.formatted === 'string' ? options.formatted : MessageFormatter.getInstance().format(options.content);
        this.quoted = options.quoted || null;
        this.user = options.user;
        this.createdTime = options.createdTime instanceof Date ? options.createdTime : new Date();
        this.meta = Object.assign({
            device: '',
            audio: 0,
        }, options.meta || {});
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
            room: this.room,
            content: this.content,
            quoted: this.quoted && quoteDepth > 0 ? this.quoted.sanitized(quoteDepth - 1) : null,
            formatted: this.formatted,
            user: this.user.sanitized(),
            createdTimestamp: this.createdTime.getTime() * 0.001,
            meta: this.meta
        };
    }
}
