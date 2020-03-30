import * as fs from "fs";
import * as sha256 from "sha256";
import {DatabaseHelper} from "./DatabaseHelper";
import SQL from "sql-template-strings";


type SkyChatUserData = any;
type SkyChatAuthToken = {
    userId: number;
    timestamp: number;
    signature: string;
}


/**
 * A SkyChatUser is an user stored in the database
 */
export class User {


    /**
     * Password salt defined in .env.json
     */
    private static passwordSalt: string;


    /**
     * Token salt defined in .env.json
     */
    private static tokenSalt: string;

    /**
     * Static init block
     */
    static initialize() {

        const env = JSON.parse(fs.readFileSync('.env.json').toString());
        User.passwordSalt = env.users_passwords_salt;
        if (! User.passwordSalt) {
            throw new Error('Please define password salt in .env.json file');
        }
        User.tokenSalt = env.users_token_salt;
        if (! User.tokenSalt) {
            throw new Error('Please define token salt in .env.json file');
        }
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
        return new User(userObject.id, userObject.username_custom, userObject.password, userObject.right, JSON.parse(userObject.data));
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
        return new User(userObject.id, userObject.username_custom, userObject.password, userObject.right, JSON.parse(userObject.data));
    }

    /**
     * Store a new user in the database
     * @param username
     * @param password
     */
    public static async registerUser(username: string, password: string): Promise<User> {
        const tms = Math.floor(Date.now() / 1000);
        const sqlQuery = SQL`insert into users
            (username, username_custom, password, right, data, tms_created, tms_last_seen) values
            (${username.toLowerCase()}, ${username}, ${''}, ${0}, ${'{}'}, ${tms}, ${tms})`;
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
    public static getAuthToken(userId: number, timestamp?: number): SkyChatAuthToken {
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
    public static async verifyAuthToken(token: any): Promise<User> {
        const authToken = User.getAuthToken(token.userId, token.timestamp);
        if (authToken.signature !== token.signature) {
            throw new Error('Invalid token');
        }
        return User.getUserById(token.userId);
    }

    public readonly id: number;

    public readonly username: string;

    private readonly password: string;

    public readonly right: number;

    public readonly data: SkyChatUserData;

    constructor(id: number, username: string, password: string, right: number, data: SkyChatUserData) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.right = right;
        this.data = data;
    }

    /**
     * Test if a given password is the current one
     * @param password
     */
    public testPassword(password: string): boolean {
        const hashedPassword = User.hashPassword(this.id, this.username, password);
        return hashedPassword === this.password;
    }

    /**
     * What will be sent to the client
     */
    public sanitized() {
        return {
            id: this.id,
            username: this.username,
            right: this.right,
            data: this.data
        }
    }
}

User.initialize();
