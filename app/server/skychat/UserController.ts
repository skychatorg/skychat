import {CommandManager} from "./commands/CommandManager";
import * as sha256 from "sha256";
import {Config} from "./Config";
import {DatabaseHelper} from "./DatabaseHelper";
import {AuthToken, User} from "./User";
import SQL from "sql-template-strings";
import {Plugin} from "./commands/Plugin";


export class UserController {

    /**
     * Validity of the auth token in seconds
     */
    public static AUTH_TOKEN_VALIDITY: number = 1000 * 60 * 60 * 24 * 7;

    private static dummyPluginInstances: {[name: string]: Plugin};

    /**
     * Static init block
     */
    public static loadDummyPluginInstances(): {[name: string]: Plugin} {

        if (typeof this.dummyPluginInstances !== 'undefined') {
            return this.dummyPluginInstances;
        }

        this.dummyPluginInstances = {};
        CommandManager.extractPlugins(CommandManager.instantiateCommands(null as any))
            .forEach(plugin => {
                this.dummyPluginInstances[plugin.name] = plugin;
            });
        return this.dummyPluginInstances;
    }

    /**
     * Static init block
     */
    public static getPluginDefaultData(pluginName: string): any {
        const plugins = this.loadDummyPluginInstances();
        if (typeof plugins[pluginName] === 'undefined') {
            return undefined;
        }
        return plugins[pluginName].defaultDataStorageValue;
    }

    /**
     * Static init block
     */
    public static getPluginsDefaultData(): {[pluginName: string]: any} {
        const plugins = this.loadDummyPluginInstances();
        const defaultValues: {[pluginName: string]: any} = {};
        for (const plugin of Object.values(plugins)) {
            if (typeof plugin.defaultDataStorageValue !== 'undefined') {
                defaultValues[plugin.name] = plugin.defaultDataStorageValue;
            }
        }
        return defaultValues;
    }

    /**
     * Get a neutral user used for sending information messages
     */
    public static getNeutralUser(): User {
        return new User(0, '~Server', '', 0, 0, 0, {
            plugins: {
                avatar: 'https://skychat.redsky.fr/uploads/2020/04/13/16-44-51-303429300.png',
                color: 'rgb(255, 255, 255)'
            }
        });
    }

    /**
     * Hash a specific user's password
     * @param userId
     * @param username
     * @param password
     */
    public static hashPassword(userId: number, username: string, password: string): string {
        if (typeof userId !== 'number' || userId <= 0 || username.length === 0 || password.length === 0) {
            throw new Error('User and passwords must be supplied to compute password hash');
        }
        return sha256(userId + password + Config.USERS_PASSWORD_SALT + username.toLowerCase());
    }

    /**
     * Get an user in the database from its id
     * @param username
     */
    public static async getUserByUsername(username: string): Promise<User> {
        const userObject = await DatabaseHelper.db.get(SQL`SELECT * FROM users WHERE username = ${username.toLowerCase()}`);
        if (! userObject) {
            throw new Error('User does not exist');
        }
        return this.userRowToObject(userObject);
    }

    /**
     * Get an user in the database from its id
     * @param userId
     */
    public static async getUserById(userId: number): Promise<User> {
        const userObject = await DatabaseHelper.db.get(SQL`SELECT * FROM users WHERE id = ${userId}`);
        if (! userObject) {
            throw new Error('User does not exist');
        }
        return this.userRowToObject(userObject);
    }

    /**
     * Convert a user row fetched from sqlite to an user object
     * @param row
     */
    public static userRowToObject(row: any): User {
        return new User(row.id, row.username_custom, row.password, row.money, row.xp, row.right, JSON.parse(row.data), JSON.parse(row.storage));
    }

    /**
     * Store a new user in the database
     * @param username
     * @param password
     */
    public static async registerUser(username: string, password: string): Promise<User> {
        const tms = Math.floor(Date.now() / 1000);
        const sqlQuery = SQL`insert into users
            (username, username_custom, password, money, xp, right, data, storage, tms_created, tms_last_seen) values
            (${username.toLowerCase()}, ${username}, ${''}, ${0}, ${0}, ${0}, ${JSON.stringify(User.DEFAULT_DATA_OBJECT)}, ${'{}'}, ${tms}, ${tms})`;
        const statement = await DatabaseHelper.db.run(sqlQuery);
        const userId = statement.lastID;
        if (! userId) {
            throw new Error('Could not register user');
        }
        const hashedPassword = UserController.hashPassword(userId, username.toLowerCase(), password);
        await DatabaseHelper.db.run(SQL`update users set password=${hashedPassword} where id=${userId}`);
        return UserController.getUserById(userId);
    }

    /**
     * Login attempt
     * @param username
     * @param password
     */
    public static async login(username: string, password: string): Promise<User> {
        const user = await UserController.getUserByUsername(username);
        if (! user.testHashedPassword(UserController.hashPassword(user.id, user.username, password))) {
            throw new Error('Incorrect password');
        }
        return user;
    }

    /**
     * Build an auth token
     * @param userId
     * @param timestamp Timestamp (in milliseconds)
     */
    public static getAuthToken(userId: number, timestamp?: number): AuthToken {
        timestamp = timestamp || Date.now();
        return {
            userId,
            timestamp,
            signature: sha256(userId + Config.USERS_TOKEN_SALT + timestamp)
        };
    }

    /**
     * Verify an auth token
     * @param token
     */
    public static async verifyAuthToken(token: AuthToken): Promise<User> {
        const authToken = UserController.getAuthToken(token.userId, token.timestamp);
        if (authToken.signature !== token.signature) {
            throw new Error('Invalid token');
        }
        if (new Date() > new Date(token.timestamp + UserController.AUTH_TOKEN_VALIDITY)) {
            throw new Error('Token expired');
        }
        return UserController.getUserById(token.userId);
    }

    /**
     * Get a plugin stored data
     * @param user
     * @param pluginName
     */
    public static getPluginData<T>(user: User, pluginName: string): any {
        return typeof user.data.plugins[pluginName] === 'undefined' ? this.getPluginDefaultData(pluginName) : user.data.plugins[pluginName];
    }

    /**
     * Remove money from an user account
     * @param user
     * @param amount
     */
    public static async buy(user: User, amount: number): Promise<void> {
        if (amount > user.money) {
            throw new Error('User has not enough money to buy this amount');
        }
        user.money -= amount;
        await UserController.sync(user);
    }

    /**
     * Give money to an user
     * @param user
     * @param amount
     */
    public static async giveMoney(user: User, amount: number): Promise<void> {
        if (amount < 0) {
            throw new Error('Can\'t give negative amount');
        }
        user.money += amount;
        await UserController.sync(user);
    }

    /**
     * Save plugin data
     * @param user
     * @param pluginName
     * @param data
     */
    public static async savePluginData(user: User, pluginName: string, data: any): Promise<void> {
        if (user.right < 0) {
            throw new Error('You must be logged to save preferences');
        }
        user.data.plugins[pluginName] = data;
        await this.sync(user);
    }

    /**
     * Sync an user to the the database
     * @param user
     */
    public static async sync(user: User) {
        await DatabaseHelper.db.run(SQL`update users set
            money=${user.money},
            xp=${user.xp},
            right=${user.right},
            data=${JSON.stringify(user.data)},
            storage=${JSON.stringify(user.storage)}            
            where id=${user.id}`);
    }
}

