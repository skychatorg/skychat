import * as fs from "fs";
import * as sha256 from "sha256";
import {DatabaseHelper} from "./DatabaseHelper";
import SQL from "sql-template-strings";


type SkyChatUserData = any;


/**
 * A SkyChatUser is an user stored in the database
 */
export class SkyChatUser {


    /**
     * Password salt defined in .env.json
     */
    private static passwordSalt: string;

    /**
     * Static init block
     */
    static initialize() {

        SkyChatUser.passwordSalt = JSON.parse(fs.readFileSync('.env.json').toString()).users_passwords_salt;
        if (! SkyChatUser.passwordSalt) {
            throw new Error('Please define password salt in .env.json file');
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
        console.log('debug', userId + SkyChatUser.passwordSalt + username.toLowerCase());
        return sha256(userId + password + SkyChatUser.passwordSalt + username.toLowerCase());
    }

    /**
     * Get an user in the database from its id
     * @param username
     */
    public static async getUserByUsername(username: string): Promise<SkyChatUser> {
        const userObject = await DatabaseHelper.db.get(SQL`SELECT * FROM users WHERE username = ${username.toLowerCase()}`);
        if (! userObject) {
            throw new Error('User does not exist');
        }
        return new SkyChatUser(userObject.id, userObject.username_custom, userObject.password, JSON.parse(userObject.data));
    }

    /**
     * Get an user in the database from its id
     * @param userId
     */
    public static async getUserById(userId: number): Promise<SkyChatUser> {
        const userObject = await DatabaseHelper.db.get(SQL`SELECT * FROM users WHERE id = ${userId}`);
        if (! userObject) {
            throw new Error('User does not exist');
        }
        return new SkyChatUser(userObject.id, userObject.username_custom, userObject.password, JSON.parse(userObject.data));
    }

    /**
     * Store a new user in the database
     * @param username
     * @param password
     */
    public static async registerUser(username: string, password: string): Promise<SkyChatUser> {
        const tms = Math.floor(Date.now() / 1000);
        const sqlQuery = SQL`insert into users
            (username, username_custom, password, data, tms_created, tms_last_seen) values
            (${username.toLowerCase()}, ${username}, ${''}, ${'{}'}, ${tms}, ${tms})`;
        const statement = await DatabaseHelper.db.run(sqlQuery);
        const userId = statement.lastID;
        if (! userId) {
            throw new Error('Could not register user');
        }
        const hashedPassword = SkyChatUser.hashPassword(userId, username.toLowerCase(), password);
        await DatabaseHelper.db.run(SQL`update users set password=${hashedPassword} where id=${userId}`);
        return SkyChatUser.getUserById(userId);
    }

    /**
     * Login attempt
     * @param username
     * @param password
     */
    public static async login(username: string, password: string): Promise<SkyChatUser> {
        const user = await SkyChatUser.getUserByUsername(username);
        if (! user.testPassword(password)) {
            throw new Error('Incorrect password');
        }
        return user;
    }

    public readonly id: number;

    public readonly username: string;

    private readonly password: string;

    public readonly data: SkyChatUserData;

    constructor(id: number, username: string, password: string, data: SkyChatUserData) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.data = data;
    }

    /**
     * Test if a given password is the current one
     * @param password
     */
    public testPassword(password: string): boolean {
        const hashedPassword = SkyChatUser.hashPassword(this.id, this.username, password);
        return hashedPassword === this.password;
    }
}

SkyChatUser.initialize();
