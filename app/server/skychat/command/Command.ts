import {Connection} from "../Connection";
import {Session} from "../Session";
import {User} from "../User";
import {Room} from "../Room";


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
    public readonly params?: CommandParam[] | {[alias: string]: CommandParam[]};

    /**
     * Minimum amount of parameters that need to be sent. Can be defined for each aliases separately or globally.
     */
    public readonly minParamCount: number | {[alias: string]: number} = 0;

    /**
     * Maximum amount of parameters that need to be sent. Can be defined for each aliases separately or globally.
     */
    public readonly maxParamCount: number | {[alias: string]: number} = Infinity;

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
    public check(alias: string, param: string, connection: Connection) {

        // Split message
        const splitParams = param.split(' ').filter(s => s !== '');

        // Check user right
        if (connection.session.user.right < this.minRight) {
            throw new Error('You don\'t have the right to execute this command');
        }

        // Check room
        if (this.roomRequired && ! connection.room) {
            throw new Error('This command needs to be executed in a room');
        }

        // Check min parameter count
        if (typeof this.minParamCount === 'number' || (this.minParamCount && this.minParamCount[alias])) {
            const minParamCount = typeof this.minParamCount === 'number' ? this.minParamCount : this.minParamCount[alias];
            if (splitParams.length < minParamCount) {
                throw new Error('Expected ' + minParamCount + ' parameters. Got ' + splitParams.length);
            }
        }

        // Check max parameter count
        if (typeof this.maxParamCount === 'number' || (this.maxParamCount && this.maxParamCount[alias])) {
            const maxParamCount = typeof this.maxParamCount === 'number' ? this.maxParamCount : this.maxParamCount[alias];
            if (splitParams.length > maxParamCount) {
                throw new Error('Expected at most ' + maxParamCount + ' parameters. Got ' + splitParams.length);
            }
        }

        // Check parameters
        if (Array.isArray(this.params) || (this.params && this.params[alias])) {
            // Get param definition to use
            const paramDefinitions: CommandParam[] = Array.isArray(this.params) ? this.params : this.params[alias];
            for (let i = 0; i < paramDefinitions.length; ++ i) {
                if (! paramDefinitions[i].pattern.exec(splitParams[i])) {
                    throw new Error('Invalid format for ' + paramDefinitions[i].name);
                }
            }
        }
    }

    /**
     * Execute the command
     * @param alias
     * @param param
     * @param connection
     */
    public async execute(alias: string, param: string, connection: Connection) {
        this.check(alias, param, connection);
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
