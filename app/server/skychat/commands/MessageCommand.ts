import {Command} from "../Command";
import {Connection} from "../generic-server/Connection";
import {SkyChatSession} from "../SkyChatSession";
import {User} from "../User";
import {Room} from "../generic-server/Room";
import {Message} from "../Message";


export class MessageCommand extends Command {

    readonly name: string = 'message';

    readonly aliases: string[] = ['m'];

    public readonly minRight: number = -1;

    public readonly roomRequired: boolean = true;

    async run(
        alias: string,
        param: string,
        connection: Connection<SkyChatSession>,
        session: SkyChatSession,
        user: User,
        room: Room | null): Promise<void> {

        const message = new Message(param, connection);
        connection.room!.send('message', message.sanitized());
    }
}
