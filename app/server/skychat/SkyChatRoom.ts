import {Room} from "./generic-server/Room";
import {Message} from "./Message";


export class SkyChatRoom extends Room {

    public readonly messageHistory: Message[] = [];

}
