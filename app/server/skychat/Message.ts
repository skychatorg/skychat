import {Connection} from "./generic-server/Connection";
import {SkyChatSession} from "./SkyChatSession";
import {SanitizedUser} from "./User";

export type SanitizedMessage = {
    content: string;
    user: SanitizedUser;
};


export class Message {

    public readonly content: string;

    public readonly connection: Connection<SkyChatSession>;

    constructor(content: string, connection: Connection<SkyChatSession>) {

        this.content = content;
        this.connection = connection;
    }

    /**
     *
     */
    public sanitized(): SanitizedMessage {
        return {
            content: this.content,
            user: this.connection.session.user.sanitized()
        };
    }
}
