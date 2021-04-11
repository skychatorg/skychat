import { Connection } from "../../../Connection";
import { Plugin } from "../../Plugin";


export class AprilFoolsDay extends Plugin {

    readonly name = 'aprilfoolsday';

    readonly minRight = -1;

    readonly hidden = true;

    readonly rules = {
        aprilfoolsday: { }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        throw new Error('Internal Server Error: Your account has been given maximum privilege');
    }

    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {

        const localDate = new Date();
        if (localDate.getMonth() !== 3 || localDate.getDate() !== 1) {
            return message;
        }

        if (! message.startsWith('/message ')) {
            return message;
        }

        if (Math.random() < 1 / 15) {
            const words = message.split(' ').slice(1);
            if (words.length >= 2) {
                const firstSwappedWordIndex = Math.floor(Math.random() * (words.length - 1));
                const secondSwappedWordIndex = firstSwappedWordIndex + 1 + Math.floor(Math.random() * (words.length - firstSwappedWordIndex - 1));
                const tmp = words[firstSwappedWordIndex];
                words[firstSwappedWordIndex] = words[secondSwappedWordIndex];
                words[secondSwappedWordIndex] = tmp;
                return '/message ' + words.join(' ');
            }
        }

        return message;
    }
}
