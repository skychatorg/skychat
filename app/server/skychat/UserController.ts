import _ from 'lodash';
import sha256 from 'sha256';
import SQL from 'sql-template-strings';
import { globalPluginGroup } from '../plugins/GlobalPluginGroup.js';
import { Config } from './Config.js';
import { DatabaseHelper } from './DatabaseHelper.js';
import { Message, MessageConstructorOptions } from './Message.js';
import { Session } from './Session.js';
import { AuthToken, User } from './User.js';

export class UserController {
    /**
     * Validity of the auth token in seconds
     */
    public static readonly AUTH_TOKEN_VALIDITY: number = 1000 * 60 * 60 * 24 * 7;

    /**
     *
     */
    public static getPluginDefaultData(pluginName: string): any {
        return _.cloneDeep(globalPluginGroup.defaultDataStorageValues[pluginName]);
    }

    /**
     */
    public static getPluginsDefaultData(): { [pluginName: string]: any } {
        return _.cloneDeep(globalPluginGroup.defaultDataStorageValues);
    }

    /**
     * Get a neutral user used for sending information messages
     */
    public static getNeutralUser(identifier?: string): User {
        return new User(-1, identifier || '[ Server ]', null, '', 0, 0, 0, {
            plugins: {
                avatar: Config.LOCATION + '/assets/images/avatars/server.png',
                custom: {
                    color: 'rgb(65, 105, 225)',
                },
            },
        });
    }

    /**
     * Create a neutral message
     */
    public static createNeutralMessage(options: Partial<MessageConstructorOptions>, identifier?: string): Message {
        return new Message({
            id: options.id,
            room: options.room,
            content: options.content || '',
            formatted: options.formatted,
            user: UserController.getNeutralUser(identifier),
            quoted: options.quoted,
            createdTime: options.createdTime,
            meta: options.meta,
        });
    }

    /**
     * Hash a specific user's password
     */
    public static hashPassword(userId: number, username: string, password: string): string {
        if (typeof userId !== 'number' || userId <= 0 || username.length === 0 || password.length === 0) {
            throw new Error('User and passwords must be supplied to compute password hash');
        }
        if (!process.env.USERS_PASSWORD_SALT || process.env.USERS_PASSWORD_SALT.trim().length === 0) {
            throw new Error('Please set the password salt before running the application.');
        }
        return sha256(userId + password + process.env.USERS_PASSWORD_SALT + username.toLowerCase());
    }

    /**
     * Get an user in the database from its id
     */
    public static async getUserByUsername(username: string): Promise<User | null> {
        const userObject = (await DatabaseHelper.db.query(SQL`SELECT * FROM users WHERE username = ${username.toLowerCase()}`)).rows[0];
        return userObject ? this.userRowToObject(userObject) : null;
    }

    /**
     * Get an user in the database from its id
     */
    public static async getUserById(userId: number): Promise<User> {
        const userObject = (await DatabaseHelper.db.query(SQL`SELECT * FROM users WHERE id = ${userId}`)).rows[0];
        if (!userObject) {
            throw new Error('User does not exist');
        }
        return this.userRowToObject(userObject);
    }

    /**
     * Get all users
     */
    public static async getAllUsers(): Promise<User[]> {
        const userObjects = (await DatabaseHelper.db.query(SQL`SELECT * FROM users`)).rows;
        return userObjects.map((o) => this.userRowToObject(o));
    }

    /**
     * Convert a user row fetched from sql to an user object
     */
    public static userRowToObject(row: any): User {
        return new User(
            row.id,
            row.username_custom,
            row.email,
            row.password,
            row.money,
            row.xp,
            row.right,
            JSON.parse(row.data),
            JSON.parse(row.storage),
        );
    }

    /**
     * Store a new user in the database
     */
    static async register(username: string, password: string): Promise<User> {
        // Check that username matches regex
        if (!User.USERNAME_LOGGED_REGEXP.test(username)) {
            throw new Error('Invalid username');
        }

        const tms = Math.floor(Date.now() / 1000);
        const sqlQuery = SQL`insert into users
            (username, username_custom, password, money, xp, "right", data, storage, tms_created, tms_last_seen) values
            (${username.toLowerCase()}, ${username}, ${''}, ${0}, ${0}, ${0}, ${JSON.stringify(
                User.DEFAULT_DATA_OBJECT,
            )}, ${'{}'}, ${tms}, ${tms}) returning *`;
        const statement = await DatabaseHelper.db.query(sqlQuery);
        const userId = statement.rows[0].id;
        if (!userId) {
            throw new Error('Could not register user');
        }
        const hashedPassword = UserController.hashPassword(userId, username.toLowerCase(), password);
        await DatabaseHelper.db.query(SQL`update users set password=${hashedPassword} where id=${userId}`);
        return UserController.getUserById(userId);
    }

    /**
     * Login attempt. If login is successful, updates the username case in the database.
     */
    static async login(username: string, password: string): Promise<User> {
        const user = await UserController.getUserByUsername(username);
        if (!user) {
            throw new Error('User does not exist');
        }
        if (!user.testHashedPassword(UserController.hashPassword(user.id, user.username, password))) {
            throw new Error('Incorrect password');
        }
        return user;
    }

    /**
     * Build an auth token
     */
    public static getAuthToken(userId: number, timestamp?: number): AuthToken {
        timestamp = timestamp || Date.now();
        if (!process.env.USERS_TOKEN_SALT || process.env.USERS_TOKEN_SALT.trim().length === 0) {
            throw new Error('Please set the token salt in the .env file before running the application.');
        }
        return {
            userId,
            timestamp,
            signature: sha256(userId + process.env.USERS_TOKEN_SALT + timestamp),
        };
    }

    /**
     * Verify an auth token
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
     */
    public static getUserPluginData<T>(user: User, pluginName: string): T {
        return typeof user.data.plugins[pluginName] === 'undefined' ? this.getPluginDefaultData(pluginName) : user.data.plugins[pluginName];
    }

    /**
     * Remove money from an user account
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
     */
    public static async giveMoney(user: User, amount: number): Promise<void> {
        if (amount < 0) {
            throw new Error("Can't give negative amount");
        }
        user.money += amount;
        await UserController.sync(user);
    }

    /**
     * Give XP to an user
     */
    public static async giveXP(user: User, amount: number): Promise<void> {
        if (amount < 0) {
            throw new Error("Can't give negative amount");
        }
        user.xp += amount;
        await UserController.sync(user);
    }

    /**
     * Save plugin data
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
     */
    public static async sync(user: User) {
        await DatabaseHelper.db.query(SQL`update users set
            email=${user.email},
            money=${user.money},
            xp=${user.xp},
            "right"=${user.right},
            data=${JSON.stringify(user.data)},
            storage=${JSON.stringify(user.storage)}            
            where id=${user.id}`);
    }

    public static async changeUsernameCase(user: User, newUsernameCase: string) {
        // Check that only the case changed
        if (user.username.toLowerCase() !== newUsernameCase.toLowerCase()) {
            throw new Error('Only the case must change when changing the username case');
        }
        // If case did not change
        if (user.username === newUsernameCase) {
            return;
        }
        // Update cased username
        user.username = newUsernameCase;
        // Update database
        await DatabaseHelper.db.query(SQL`update users set username_custom=${user.username} where id=${user.id}`);
    }

    /**
     * Change one's username
     */
    public static async changeUsername(user: User, newUsername: string, currentPassword: string) {
        // Compute new password
        const newHashedPassword = UserController.hashPassword(user.id, newUsername.toLowerCase(), currentPassword);
        // Update user object
        user.username = newUsername;
        user.setHashedPassword(newHashedPassword);
        // Update database
        await DatabaseHelper.db.query(SQL`update users set
            username=${user.username.toLowerCase()},
            username_custom=${user.username},
            password=${newHashedPassword}
            where id=${user.id}`);
    }

    /**
     * Change one's password
     */
    public static async changePassword(user: User, newPassword: string) {
        // Compute new password
        const newHashedPassword = UserController.hashPassword(user.id, user.username.toLowerCase(), newPassword);
        // Update user object
        user.setHashedPassword(newHashedPassword);
        // Update database
        await DatabaseHelper.db.query(SQL`update users set password=${newHashedPassword} where id=${user.id}`);
    }

    /**
     * Get a user session (or create one if it does not exist)
     */
    public static async getOrCreateUserSession(user: User, usernameWithCustomCase?: string): Promise<Session> {
        const identifier = user.username.toLowerCase();
        const recycledSession = Session.getSessionByIdentifier(identifier);
        if (recycledSession) {
            if (usernameWithCustomCase) {
                await UserController.changeUsernameCase(user, usernameWithCustomCase);
            }
            return recycledSession;
        }
        const newSession = new Session(identifier);
        if (usernameWithCustomCase) {
            await UserController.changeUsernameCase(user, usernameWithCustomCase);
        }
        newSession.setUser(user);
        return newSession;
    }
}
