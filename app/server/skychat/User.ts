import * as fs from "fs";
import * as sha256 from "sha256";
import {DatabaseHelper} from "./DatabaseHelper";
import SQL from "sql-template-strings";
import {CommandManager} from "./commands/CommandManager";


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
     * Password salt defined in .env.json
     */
    private static passwordSalt: string = JSON.parse(fs.readFileSync('.env.json').toString()).users_passwords_salt;


    /**
     * Token salt defined in .env.json
     */
    private static tokenSalt: string = JSON.parse(fs.readFileSync('.env.json').toString()).users_token_salt;

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
        return sha256(userId + password + User.passwordSalt + username.toLowerCase());
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
            signature: sha256(userId + this.tokenSalt + timestamp)
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
     * Save plugin data
     * @param user
     * @param pluginName
     * @param data
     */
    public static async savePluginData(user: User, pluginName: string, data: any): Promise<void> {
        user.data.plugins[pluginName] = data;
        await DatabaseHelper.db.run(SQL`update users set data=${JSON.stringify(user.data)} where id=${user.id}`);
    }

    public readonly id: number;

    public readonly username: string;

    private readonly password: string;

    public readonly money: number;

    public readonly xp: number;

    public readonly right: number;

    public readonly data: UserData;

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
