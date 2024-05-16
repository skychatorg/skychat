import fs from 'fs';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Connection } from '../skychat/Connection.js';
import { Room } from '../skychat/Room.js';
import { Session } from '../skychat/Session.js';
import { User } from '../skychat/User.js';
import { UserController } from '../skychat/UserController.js';

/**
 * Plugin command parameters description object
 */
export type PluginCommandRules = {
    /**
     * Minimum number of expected parameters
     */
    minCount?: number;

    /**
     * Maximum number of parameters
     */
    maxCount?: number;

    /**
     * Minimum duration between two consecutive calls
     */
    coolDown?: number;

    /**
     * Maximum number of time this function can be called within a 10 second window
     */
    maxCallsPer10Seconds?: number;

    /**
     * Cost of each call per right level
     */
    callCostPerRight?: [number, number][]; // [right, weight]

    /**
     * Expected parameters
     */
    params?: {
        name: string;
        pattern: RegExp;
        info?: string;
    }[];
};

export type PluginCommandAllRules = Record<string, PluginCommandRules>;

/**
 * Abstract class that represents a plugin. A plugin has access to multiple points of the application through the usage
 *  of hooks. Every room has its own instance of plugin. A plugin can also save data to persistent storage.
 */
export abstract class Plugin {
    /**
     * Base path for plugin persistent storage
     */
    static readonly STORAGE_BASE_PATH: string = 'storage';

    /**
     * Helper regexp used by sub classes
     */
    static readonly POSITIVE_INTEGER_REGEXP: RegExp = /^([0-9]+)$/;

    /**
     * Some plugins (i.e. plugin to ban users) are globally available.
     * They have a single storage file, and they are instantiated only once at the root-level instead of once per room.
     * This static attribute need to be set
     * @abstract
     */
    static readonly isGlobal: boolean;

    /**
     * Plugin command name
     */
    static readonly commandName: string = 'plugin';

    /**
     * Plugin command aliases
     */
    static readonly commandAliases: string[] = [];

    /**
     * If the plugin uses user storage, it needs to define a default value for its custom entry in user data object.
     */
    static readonly defaultDataStorageValue?: any;

    /**
     * Define command rules, ie expected parameters and cooldown. Can be defined globally or per command alias.
     */
    readonly rules: PluginCommandAllRules = {};

    /**
     * Minimum right to execute this function
     */
    readonly minRight: number = -1;

    /**
     * Is the command reserved for op
     */
    readonly opOnly?: boolean;

    /**
     * Whether this command can be invoked using /{alias}
     */
    readonly callable: boolean = true;

    /**
     * Whether this command should be hidden from the /help
     */
    readonly hidden: boolean = false;

    /**
     * Limiters for this plugin
     */
    private readonly limiters: Record<string, { cooldown?: RateLimiterMemory; '10sec'?: RateLimiterMemory }> = {};

    /**
     * This plugin's persistent storage
     */
    protected storage: any = null;

    /**
     * Save this plugin's data to the disk
     */
    protected syncStorage(): void {
        if (typeof this.storage === 'undefined') {
            return;
        }
        fs.mkdirSync(this.getStoragePath(), { recursive: true });
        fs.writeFileSync(this.getStoragePath() + `/${this.commandName}.json`, JSON.stringify(this.storage));
    }

    /**
     * Save this plugin's data to the disk
     */
    protected loadStorage(): void {
        try {
            this.storage = JSON.parse(fs.readFileSync(this.getStoragePath() + `/${this.commandName}.json`).toString());
        } catch (e) {
            this.syncStorage();
        }
    }

    /**
     * Get command name
     */
    public get commandName(): string {
        return (<any>this.constructor).commandName;
    }

    /**
     * Get this plugin's storage path.
     * Path differ depending on whether the plugin is global or per-room.
     * @abstract
     */
    public abstract getStoragePath(): string;

    /**
     * Load user data for this plugin
     */
    public getUserData<T>(user: User): T {
        return UserController.getUserPluginData<T>(user, this.commandName);
    }

    /**
     * Save user data for this plugin
     */
    public async saveUserData(user: User, data: any) {
        await UserController.savePluginData(user, this.commandName, data);
    }

    /**
     * Check command rights and arguments
     */
    async check(alias: string, param: string, connection: Connection) {
        // Check room
        if (!connection.room) {
            throw new Error('This command needs to be executed in a room');
        }

        if (!connection.session.isOP()) {
            // Check user right
            if (connection.session.user.right < this.minRight) {
                throw new Error("You don't have the right to execute this command");
            }

            // Check OP
            if (this.opOnly && !connection.session.isOP()) {
                throw new Error('Command is only for op');
            }

            // Check parameters
            if (this.rules && typeof this.rules[alias] === 'object') {
                const coolDown = this.rules[alias].coolDown ?? Infinity;
                const maxCallsPer10Seconds = this.rules[alias].maxCallsPer10Seconds ?? Infinity;
                const callWeightPerRight = this.rules[alias].callCostPerRight;

                // If associated limiter wasn't set, set it
                if (typeof this.limiters[alias] === 'undefined') {
                    this.limiters[alias] = {};
                    if (coolDown !== Infinity) {
                        this.limiters[alias].cooldown = new RateLimiterMemory({
                            points: 1,
                            duration: coolDown / 1000,
                        });
                    }
                    if (maxCallsPer10Seconds !== Infinity) {
                        this.limiters[alias]['10sec'] = new RateLimiterMemory({
                            points: maxCallsPer10Seconds,
                            duration: 10,
                        });
                    }
                }

                // Strict cooldown
                if (this.limiters[alias].cooldown) {
                    try {
                        await this.limiters[alias].cooldown?.consume(connection.ip, 1);
                    } catch (error) {
                        throw new Error(`You must wait before using this command again (${alias})`);
                    }
                }

                // 10-sec cooldown
                if (typeof this.limiters[alias]['10sec'] === 'object') {
                    let cost = 1;
                    if (callWeightPerRight && callWeightPerRight.length > 0) {
                        const nextEntry = callWeightPerRight.findIndex(([right]) => connection.session.user.right < right);
                        if (nextEntry === 0) {
                            // If user has a right lower than the lowest right in the list, use the lowest right
                            cost = callWeightPerRight[0][1];
                        } else if (nextEntry === -1) {
                            // If user has a right higher than the highest right in the list, use the highest right
                            cost = callWeightPerRight[callWeightPerRight.length - 1][1];
                        } else if (nextEntry > 0) {
                            cost = callWeightPerRight[nextEntry - 1][1];
                        }
                    }
                    try {
                        await this.limiters[alias]['10sec']?.consume(connection.ip, cost);
                    } catch (error) {
                        throw new Error(`You must wait before using this command again (${alias})`);
                    }
                }
            }
        }

        // Check parameter count and format
        if (this.rules && typeof this.rules[alias] === 'object') {
            const splitParams = param.length === 0 ? [] : param.split(' ');
            const entryPointRule = this.rules[alias];
            const params = entryPointRule.params || [];
            const minParamCount = entryPointRule.minCount || 0;
            const maxParamCount = entryPointRule.maxCount || Infinity;

            if (splitParams.length < minParamCount) {
                throw new Error('Expected at least ' + minParamCount + ' parameters. Got ' + splitParams.length);
            } else if (splitParams.length > maxParamCount) {
                throw new Error('Expected at most ' + maxParamCount + ' parameters. Got ' + splitParams.length);
            }
            // Check parameter format
            for (let i = 0; i < Math.min(params.length, splitParams.length); ++i) {
                if (!params[i].pattern.exec(splitParams[i])) {
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
        await this.check(alias, param, connection);
        await this.run(alias, param, connection, connection.session, connection.session.user, connection.room);
    }

    /**
     * Plugin implementation
     */
    public abstract run(
        alias: string,
        param: string,
        connection: Connection,
        session: Session,
        user: User,
        room: Room | null,
    ): Promise<void>;

    /**
     * When binary data is received
     * @abstract
     * @param _connection
     * @param _messageType
     * @param _data
     * @returns Whether the data was handled. If returning true, no other plugin will be able to handle binary data.
     */
    // eslint-disable-next-line no-unused-vars
    public async onBinaryDataReceived(_connection: Connection, _messageType: number, _data: Buffer): Promise<boolean> {
        return false;
    }
}
