import {Connection} from "../Connection";
import {Session} from "../Session";
import {User} from "../User";
import {Room} from "../Room";


/**
 * Command parameters description object
 */
export type CommandEntryPointRule = {

    /**
     * Minimum number of expected parameters
     */
    minCount?: number;

    /**
     * Maximum number of parameters
     */
    maxCount?: number;

    /**
     * Cooldown in milliseconds
     */
    coolDown?: number;

    /**
     * Expected parameters
     */
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
     * A command is attached to a specific room
     */
    public readonly room: Room;

    /**
     * Command name
     */
    public abstract readonly name: string;

    /**
     * Command aliases
     */
    public readonly aliases: string[] = [];

    /**
     * Define command rules, ie expected parameters and cooldown. Can be defined globally or per command alias.
     */
    public readonly rules?: CommandEntryPointRule | {[alias: string]: CommandEntryPointRule};

    /**
     * Minimum right to execute this function
     */
    public readonly minRight: number = -1;

    /**
     *
     * @param room
     */
    private readonly coolDownEntries: {[identifier: string]: Date} = {};

    constructor(room: Room) {
        this.room = room;
    }

    /**
     * Check command rights and arguments
     */
    public check(alias: string, param: string, connection: Connection) {

        // Check room
        if (! connection.room) {
            throw new Error('This command needs to be executed in a room');
        }

        // Split message
        const splitParams = param.split(' ').filter(s => s !== '');

        // Check user right
        if (connection.session.user.right < this.minRight) {
            throw new Error('You don\'t have the right to execute this command');
        }

        // Check parameters
        if (this.rules && (typeof this.rules.minCount !== 'undefined' || typeof (this.rules as any)[alias] === 'object')) {

            // Get rule object
            const entryPointRule: CommandEntryPointRule = typeof this.rules.minCount !== 'undefined' ? this.rules : (this.rules as any)[alias];
            const minParamCount = entryPointRule.minCount || 0;
            const maxParamCount = entryPointRule.maxCount || Infinity;
            const coolDown = entryPointRule.coolDown || 0;
            const params = entryPointRule.params || [];

            // Check cool down
            if (coolDown > 0) {
                const identifier = connection.session.identifier;
                // If a cool down entry exists
                if (typeof this.coolDownEntries[identifier] !== 'undefined') {
                    // If cool down still applies
                    if (new Date() < new Date(this.coolDownEntries[identifier].getTime() + coolDown)) {
                        throw new Error('Cool down for ' + alias + ' still applies');
                    }
                }
                this.coolDownEntries[identifier] = new Date();
            }

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
