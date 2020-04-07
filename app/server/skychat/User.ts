import * as fs from "fs";
import * as sha256 from "sha256";
import {DatabaseHelper} from "./DatabaseHelper";
import SQL from "sql-template-strings";
import {CommandManager} from "./commands/CommandManager";
import {Config} from "./Config";


type UserData = {
    plugins: {[pluginName: string]: any}
};

type AuthToken = {
    userId: number;
    timestamp: number;
    signature: string;
}

export type SanitizedUser = {
    id: number;
    username: string;
    money: number;
    xp: number;
    right: number;
    data: UserData;
}


/**
 * A SkyChatUser is an user stored in the database
 */
export class User {

    /**
     * Default user data object. This object is filled by the command manager to add the default values for each loaded
     *  plugin.
     */
    static readonly DEFAULT_DATA_OBJECT: UserData = {
        plugins: {}
    };

    /**
     * Neutral user used for sending erros and information
     */
    public static BOT_USER: User = new User(0, '~Server', '', 0, 0, 0);

    /**
     * Username regexp (including guests)
     */
    public static USERNAME_REGEXP: RegExp = /^\*?[a-zA-Z0-9]{3,16}$/;

    /**
     * Valid username regexp
     */
    public static USERNAME_LOGGED_REGEXP: RegExp = /^[a-zA-Z0-9]{3,16}$/;

    /**
     * Validity of the auth token in seconds
     */
    public static AUTH_TOKEN_VALIDITY: number = 1000 * 60 * 60 * 6;

    /**
     * Static init block
     */
    static initialize() {

        CommandManager
            .extractPlugins(CommandManager.instantiateCommands(null as any))
            .forEach(plugin => {
            if (typeof plugin.defaultDataStorageValue !== 'undefined') {
                User.DEFAULT_DATA_OBJECT.plugins[plugin.name] = plugin.defaultDataStorageValue;
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
        return new User(userObject.id, userObject.username_custom, userObject.password, userObject.money, userObject.xp, userObject.right, JSON.parse(userObject.data));
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
        return new User(userObject.id, userObject.username_custom, userObject.password, userObject.money, userObject.xp, userObject.right, JSON.parse(userObject.data));
    }

    /**
     * Store a new user in the database
     * @param username
     * @param password
     */
    public static async registerUser(username: string, password: string): Promise<User> {
        const tms = Math.floor(Date.now() / 1000);
        const sqlQuery = SQL`insert into users
            (username, username_custom, password, money, xp, right, data, tms_created, tms_last_seen) values
            (${username.toLowerCase()}, ${username}, ${''}, ${0}, ${0}, ${0}, ${JSON.stringify(this.DEFAULT_DATA_OBJECT)}, ${tms}, ${tms})`;
        const statement = await DatabaseHelper.db.run(sqlQuery);
        const userId = statement.lastID;
        if (! userId) {
            throw new Error('Could not register user');
        }
        const hashedPassword = User.hashPassword(userId, username.toLowerCase(), password);
        await DatabaseHelper.db.run(SQL`update users set password=${hashedPassword} where id=${userId}`);
        return User.getUserById(userId);
    }

    /**
     * Login attempt
     * @param username
     * @param password
     */
    public static async login(username: string, password: string): Promise<User> {
        const user = await User.getUserByUsername(username);
        if (! user.testPassword(password)) {
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
        const authToken = User.getAuthToken(token.userId, token.timestamp);
        if (authToken.signature !== token.signature) {
            throw new Error('Invalid token');
        }
        if (new Date() > new Date(token.timestamp + User.AUTH_TOKEN_VALIDITY)) {
            throw new Error('Token expired');
        }
        return User.getUserById(token.userId);
    }

    /**
     * Get a plugin stored data
     * @param user
     * @param pluginName
     */
    public static getPluginData<T>(user: User, pluginName: string): any {
        return user.data.plugins[pluginName];
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
        await User.sync(user);
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
        await User.sync(user);
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
            data=${JSON.stringify(user.data)}            
            where id=${user.id}`);
    }

    public readonly id: number;

    public readonly username: string;

    private readonly password: string;

    public money: number;

    public xp: number;

    public right: number;

    public data: UserData;

    constructor(id: number, username: string, password: string, money: number, xp: number, right: number, data?: UserData) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.money = money;
        this.xp = xp;
        this.right = right;
        this.data = typeof data !== 'undefined' ? data : JSON.parse(JSON.stringify(User.DEFAULT_DATA_OBJECT));
    }

    /**
     * Test if a given password is the current one
     * @param password
     */
    public testPassword(password: string): boolean {
        return User.hashPassword(this.id, this.username, password) === this.password;
    }

    /**
     * What will be sent to the client
     */
    public sanitized(): SanitizedUser {
        return {
            id: this.id,
            username: this.username,
            money: this.money,
            right: this.right,
            xp: this.xp,
            data: this.data
        }
    }
}

User.initialize();
