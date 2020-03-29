import {SkyChatCommand} from "../SkyChatCommand";
import {Connection} from "../../generic-server/Connection";
import {SkyChatSession} from "../SkyChatSession";


export class Message extends SkyChatCommand {

    readonly name: string = 'message';

    readonly aliases: string[] = ['m'];

    public readonly minRight: number = -1;

    public readonly roomRequired: boolean = true;

    async run(param: string, connection: Connection<SkyChatSession>): Promise<void> {
        connection.room!.send('message', param);
    }
}
