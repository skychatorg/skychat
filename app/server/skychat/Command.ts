import {Connection} from "./Connection";
import {Session} from "./Session";
import {User} from "./User";
import {Room} from "./Room";


/**
 * A command parameter description object
 */
export type CommandParam = {
    name: string,
    pattern: RegExp,
    info?: string
};

/**
 * Base class for a skychat command
 */
export abstract class Command {

    /**
     * Command name
     */
    public abstract readonly name: string;

    /**
     * Command aliases
     */
    public readonly aliases: string[] = [];

    /**
     * Define expected parameters. Can be defined globally or per command alias.
     */
    public readonly params?: CommandParam[] | {[alias: string]: CommandParam};

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
    public check(param: string, connection: Connection) {

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
     * @param alias
     * @param param
     * @param connection
     */
    public async execute(alias: string, param: string, connection: Connection) {
        this.check(param, connection);
        await this.run(alias, param, connection, connection.session, connection.session.user, connection.room);
    }

    /**
     * Command implementation
     */
    public abstract async run(
        alias: string,
        param: string,
        connection: Connection,
        session: Session,
        user: User,
        room: Room | null
    ): Promise<void>;
}
