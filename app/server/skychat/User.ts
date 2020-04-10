import * as _ from "lodash"
import {UserController} from "./UserController"; // Import the entire lodash library


export type UserData = {
    plugins: {[pluginName: string]: any}
};

export type AuthToken = {
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
     * Default user data object.
     */
    static readonly DEFAULT_DATA_OBJECT: UserData = {
        plugins: {}
    };

    /**
     * Username regexp (including guests)
     */
    public static USERNAME_REGEXP: RegExp = /^\*?[a-zA-Z0-9_]{3,16}$/;

    /**
     * Valid username regexp
     */
    public static USERNAME_LOGGED_REGEXP: RegExp = /^[a-zA-Z0-9_]{3,16}$/;

    public readonly id: number;

    public readonly username: string;

    private readonly password: string;

    public money: number;

    public xp: number;

    public right: number;

    public data: UserData;

    public storage: any;

    constructor(id: number, username: string, password: string, money: number, xp: number, right: number, data?: UserData, storage?: any) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.money = money;
        this.xp = xp;
        this.right = right;
        this.data = typeof data !== 'undefined' ? data : JSON.parse(JSON.stringify(User.DEFAULT_DATA_OBJECT));
        this.data.plugins = Object.assign(this.data.plugins || {}, _.cloneDeep(UserController.getPluginsDefaultData()));
        this.storage = storage || {};
    }

    /**
     * Test if a given password is the current one
     * @param hashed
     */
    public testHashedPassword(hashed: string): boolean {
        return hashed === this.password;
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

