import {Connection} from "./Connection";
import {Session} from "./Session";
import {SanitizedUser} from "./User";

export type SanitizedMessage = {
    content: string;
    user: SanitizedUser;
};


export class Message {

    public readonly content: string;

    public readonly connection: Connection;

    constructor(content: string, connection: Connection) {

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
