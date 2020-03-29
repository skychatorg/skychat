import {Connection} from "../generic-server/Connection";
import {SkyChatSession} from "./SkyChatSession";
import {Room} from "../generic-server/Room";
import {SkyChatUser} from "./SkyChatUser";


export abstract class SkyChatCommand {

    /**
     * Command name
     */
    public abstract readonly name: string;

    /**
     * Command aliases
     */
    public readonly aliases: string[] = [];

    /**
     * Minimum right to execute this function
     */
    public readonly minRight: number = -1;

    /**
     * Whether the connection needs to be in a room to execute this command
     */
    public readonly roomRequired: boolean = true;

    /**
     * Check command rights and arguments
     */
    public check(param: string, connection: Connection<SkyChatSession>) {

        // Check user right
        if (connection.session.user.right < this.minRight) {
            throw new Error('You don\'t have the right to execute this command');
        }

        // Check room
        if (this.roomRequired && ! connection.room) {
            throw new Error('This command needs to be executed in a room');
        }
    }

    /**
     * Execute the command
     * @param param
     * @param connection
     */
    public async execute(param: string, connection: Connection<SkyChatSession>) {
        this.check(param, connection);
        await this.run(param, connection, connection.session, connection.session.user, connection.room);
    }

    /**
     * Command implementation
     */
    public abstract async run(
        param: string,
        connection: Connection<SkyChatSession>,
        session: SkyChatSession,
        user: SkyChatUser,
        room: Room | null
    ): Promise<void>;
}
