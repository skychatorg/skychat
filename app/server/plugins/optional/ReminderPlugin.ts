import { Connection } from "../../skychat/Connection";
import { UserController } from "../../skychat/UserController";
import { RoomPlugin } from "../RoomPlugin";


export class ReminderPlugin extends RoomPlugin {

    static readonly TIME_PATTERN: RegExp = /^([0-9]+)(s|m|h)$/;

    static readonly commandName = 'remindme';

    readonly minRight = 0;

    readonly hidden = true;
    readonly rules = {
        remindme: {
            maxCallsPer10Seconds: 1,
            minCount: 1,
            params: [
                {name: 'time', pattern: /^([0-9]+)(s|m|h)$/},
                {name: 'message', pattern: /./},
            ]
        }
    };

    sleep(duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
    
        const timeMatches: RegExpMatchArray | null = param.split(' ')[0].match(ReminderPlugin.TIME_PATTERN);
        if (! timeMatches) {
            throw new Error('Give a valid time, e.g. 1h for one hour or 4m for 4 minutes')
        }
        const [_, amountRaw, unitRaw]: string[] = timeMatches;
        const amount = parseInt(amountRaw);
        const multiplier: number = ({
            's': 1,
            'm': 60,
            'h': 60 * 60,
        } as any)[unitRaw];

        // User can let a comment
        const message = param.split(' ').slice(1).join(' ');

        // Send immediate notification to user that he will be notified
        connection.send('message', UserController.createNeutralMessage({
            content: `You will be notified in ${amount * multiplier} seconds (${amountRaw}${unitRaw})`,
            room: this.room.id,
            id: 0,
        }, 'Reminder').sanitized());

        // Sleep for given duration
        await this.sleep(amount * multiplier * 1000);

        // If user disconnected, do not notify him
        if (! connection.session) {
            return;
        }

        // Notify user
        for (let i = 0; i < 6; ++ i) {
            connection.send('message', UserController.createNeutralMessage({content: `@${connection.session.identifier}`, room: this.room.id, id: 0}, 'Reminder').sanitized());
            await this.sleep(100);;
        }
        connection.send('message', UserController.createNeutralMessage({
            content: `Hey @${connection.session.identifier}, you asked ${amountRaw}${unitRaw} ago to be notified now.` + (message ? ` \n"${message}"` : ''),
            room: this.room.id,
            id: 0,
        }, 'Reminder').sanitized());
    }
}
