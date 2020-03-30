import {Command} from "../Command";
import {Connection} from "../Connection";
import {Session} from "../Session";
import {User} from "../User";
import {Room} from "../Room";
import {Message} from "../Message";


export class MessageCommand extends Command {

    readonly name: string = 'message';

    readonly aliases: string[] = ['m'];

    public readonly minRight: number = -1;

    public readonly roomRequired: boolean = true;

    async run(
        alias: string,
        param: string,
        connection: Connection,
        session: Session,
        user: User,
        room: Room | null): Promise<void> {

        const message = new Message(param, connection);
        connection.room!.send('message', message.sanitized());
    }
}
