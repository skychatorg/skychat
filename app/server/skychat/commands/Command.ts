import {Connection} from "../Connection";
import {Session} from "../Session";
import {User} from "../User";
import {Room} from "../Room";


/**
 * Command parameters description object
 */
export type CommandParamDefinitions = {
    minCount?: number;
    maxCount?: number;
    params?: {
        name: string,
        pattern: RegExp,
        info?: string
    }[];
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
    public readonly params?: CommandParamDefinitions | {[alias: string]: CommandParamDefinitions};

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

        // Check parameters
        if (this.params && (typeof this.params.minCount !== 'undefined' || typeof (this.params as any)[alias] === 'object')) {
            const paramDefinitions: CommandParamDefinitions = typeof this.params.minCount !== 'undefined' ? this.params : (this.params as any)[alias];
            const minParamCount = paramDefinitions.minCount || 0;
            const maxParamCount = paramDefinitions.maxCount || Infinity;
            const params = paramDefinitions.params || [];
            // Check parameter count
            if (splitParams.length < minParamCount) {
                throw new Error('Expected at least ' + minParamCount + ' parameters. Got ' + splitParams.length);
            } else if (splitParams.length > maxParamCount) {
                throw new Error('Expected at most ' + maxParamCount + ' parameters. Got ' + splitParams.length);
            }
            // Check parameter format
            for (let i = 0; i < params.length; ++ i) {
                if (! params[i].pattern.exec(splitParams[i])) {
                    throw new Error('Invalid format for ' + params[i].name);
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
