import fs from 'fs';
import { Connection } from '../skychat/Connection';
import { Session } from '../skychat/Session';
import { User } from '../skychat/User';
import { Room } from '../skychat/Room';
import { UserController } from '../skychat/UserController';


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
     * Expected parameters
     */
    params?: {
        name: string,
        pattern: RegExp,
        info?: string
    }[];
};



/**
 * Abstract class that represents a plugin. A plugin has access to multiple points of the application through the usage
 *  of hooks. Every room has its own instance of plugin. A plugin can also save data to persistent storage.
 */
export abstract class Plugin {
    /**
     * Base path for plugin persistent storage
     */
    public static readonly STORAGE_BASE_PATH: string = 'storage';

    /**
     * Helper regexp used by sub classes
     */
    public static readonly POSITIVE_INTEGER_REGEXP: RegExp = /^([0-9]+)$/;

    /**
     * Some plugins (i.e. plugin to ban users) are globally available.
     * They have a single storage file, and they are instantiated only once at the root-level instead of once per room.
     * This static attribute need to be set
     * @abstract
     */
    public static readonly isGlobal: boolean;

    /**
     * Plugin command name
     */
    public static readonly commandName: string = 'plugin';

    /**
     * Plugin command aliases
     */
    public static readonly commandAliases: string[] = [];

    /**
     * If the plugin uses user storage, it needs to define a default value for its custom entry in user data object.
     */
    public static readonly defaultDataStorageValue?: any;

    /**
     * Define command rules, ie expected parameters and cooldown. Can be defined globally or per command alias.
     */
    public readonly rules?: {[alias: string]: PluginCommandRules};

    /**
     * Minimum right to execute this function
     */
    public readonly minRight: number = -1;

    /**
     * Is the command reserved for op
     */
    public readonly opOnly?: boolean;

    /**
     * Whether this command can be invoked using /{alias}
     */
    public readonly callable: boolean = true;

    /**
     * Whether this command should be hidden from the /help
     */
    public readonly hidden: boolean = false;

    /**
     *
     * @param room
     */
    private readonly coolDownEntries: {[identifier: string]: {first: Date, last: Date, count: number}} = {};

    /**
     * Plugins can modify application values on-the-fly. Therefore it is important to know in advance
     */
    public readonly priority: number = 0;

    /**
     * This plugin's persistent storage
     */
    protected storage: any = null;

    /**
     * Save this plugin's data to the disk
     */
    protected syncStorage(): void {
        if (! this.storage) {
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
     * @param user
     * @returns
     */
    public getUserData<T>(user: User): T {
        return UserController.getUserPluginData<T>(user, this.commandName);
    }

    /**
     * Save user data for this plugin
     * @param user
     * @returns
     */
    public async saveUserData(user: User, data: any) {
        await UserController.savePluginData(user, this.commandName, data);
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
        const splitParams = param.length === 0 ? [] : param.split(' ');

        // Check user right
        if (connection.session.user.right < this.minRight) {
            throw new Error('You don\'t have the right to execute this command');
        }

        // Check op
        if (this.opOnly && ! connection.session.isOP()) {
            throw new Error('Command is only for op');
        }

        // Check parameters
        if (this.rules && typeof this.rules[alias] === 'object') {
            // Get rule object
            const entryPointRule = this.rules[alias];
            const minParamCount = entryPointRule.minCount || 0;
            const maxParamCount = entryPointRule.maxCount || Infinity;
            const coolDown = entryPointRule.coolDown || 0;
            const maxCallsPer10Seconds = entryPointRule.maxCallsPer10Seconds || Infinity;
            const params = entryPointRule.params || [];

            // Check cool down
            const identifier = connection.session.identifier;
            // 1. Check
            if (typeof this.coolDownEntries[identifier] !== 'undefined') {
                // If cool down still applies
                if (new Date() < new Date(this.coolDownEntries[identifier].last.getTime() + coolDown)) {
                    throw new Error(`${alias}: Cool down still applies`);
                }
                // If 10 second window entry still valid
                if (this.coolDownEntries[identifier].first.getTime() + 10 * 1000 > new Date().getTime()) {
                    // If maximum number of calls per 10 seconds reached
                    if (this.coolDownEntries[identifier].count > maxCallsPer10Seconds) {
                        throw new Error(`${alias}: 10 seconds window cool down still applies`);
                    }
                }
            }
            // 2. Update cool down entry
            if (typeof this.coolDownEntries[identifier] !== 'undefined') {
                // If entry expired
                if (this.coolDownEntries[identifier].first.getTime() + 10 * 1000 < new Date().getTime()) {
                    delete this.coolDownEntries[identifier];
                }
            }
            if (typeof this.coolDownEntries[identifier] === 'undefined') {
                this.coolDownEntries[identifier] = { first: new Date(), last: new Date(), count: 1 };
            } else {
                this.coolDownEntries[identifier].last = new Date();
                this.coolDownEntries[identifier].count ++;
            }

            // Check parameter count
            if (splitParams.length < minParamCount) {
                throw new Error('Expected at least ' + minParamCount + ' parameters. Got ' + splitParams.length);
            } else if (splitParams.length > maxParamCount) {
                throw new Error('Expected at most ' + maxParamCount + ' parameters. Got ' + splitParams.length);
            }

            // Check parameter format
            for (let i = 0; i < Math.min(params.length, splitParams.length); ++ i) {
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
     * Plugin implementation
     */
    public abstract run(
        alias: string,
        param: string,
        connection: Connection,
        session: Session,
        user: User,
        room: Room | null
    ): Promise<void>;

    /**
     * When binary data is received
     * @abstract
     * @param _connection
     * @param _messageType
     * @param _data
     * @returns Whether the data was handled. If returning true, no other plugin will be able to handle binary data.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async onBinaryDataReceived(_connection: Connection, _messageType: number, _data: Buffer): Promise<boolean> {
        return false;
    }
}
