import {Connection} from "../../Connection";
import {Plugin} from "../../Plugin";
import {Room} from "../../Room";
import {User} from "../../User";
import {ConnectedListPlugin} from "./ConnectedListPlugin";
import {UserController} from "../../UserController";


export class MoneyFarmerPlugin extends Plugin {

    public static readonly MAX_INACTIVITY_DURATION_MS: number = 5 * 60 * 1000;

    public static readonly TICK_AMOUNTS_LIMITS: {limit: number, amount: number}[] = [
        {limit: 15 * 100, amount: 3},
        {limit: 30 * 100, amount: 2},
        {limit: 100 * 100, amount: 1},
    ];

    readonly name = 'moneyfarmer';

    readonly minRight = -1;

    readonly callable = false;

    constructor(room: Room) {
        super(room);

        if (this.room) {
            setInterval(this.tick.bind(this), 60 * 1000);
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> { }

    /**
     * Get the amount to give to a specific user for this tick
     * @param user
     */
    private getTickAmount(user: User): number {
        const entry = MoneyFarmerPlugin
            .TICK_AMOUNTS_LIMITS
            .filter(entry => entry.limit >= user.money)[0];
        return entry ? entry.amount : 0;
    }

    private async tick(): Promise<void> {
        // Get rooms in the session
        const sessions = Array.from(new Set(this.room.connections.map(connection => connection.session)));
        // For each session in the room
        for (const session of sessions) {
            // If it's not a logged session, continue
            if (session.user.right < 0) {
                continue;
            }
            // If user inactive for too long, continue
            if (session.lastMessageDate.getTime() + MoneyFarmerPlugin.MAX_INACTIVITY_DURATION_MS < new Date().getTime()) {
                continue;
            }

            const amount = this.getTickAmount(session.user);
            if (amount === 0) {
                continue
            }
            session.user.money += amount;
            await UserController.sync(session.user);
        }
        await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }
}
