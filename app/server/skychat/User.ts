import * as _ from "lodash"
import { UserController } from "./UserController";
import { Config } from "./Config";


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
    rank: {[size: string]: string};
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
     * Get the rank image of this user from an xp amount
     */
    static getRankByXp(xp: number): {limit: number, images: {[size: string]: string}} {
        const entry = Config.RANKS
            .filter(entry => xp >= entry.limit)[0];
        return entry ? entry : Config.RANKS[Config.RANKS.length - 1];
    }

    /**
     * Username regexp (including guests)
     */
    public static USERNAME_REGEXP: RegExp = /^\*?[^\s]{2,}$/;

    /**
     * Valid username regexp
     */
    public static USERNAME_LOGGED_REGEXP: RegExp = /^[a-zA-Z0-9-_]{3,16}$/;

    /**
     * Valid email regexp
     */
    public static EMAIL_REGEXP: RegExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    public readonly id: number;

    public username: string;

    public email: string | null;

    private password: string;

    public money: number;

    public xp: number;

    public right: number;

    public data: UserData;

    public storage: any;

    constructor(id: number, username: string, email: string | null, password: string, money: number, xp: number, right: number, data?: UserData, storage?: any) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.password = password;
        this.money = money;
        this.xp = xp;
        this.right = right;
        this.data = typeof data !== 'undefined' ? data : JSON.parse(JSON.stringify(User.DEFAULT_DATA_OBJECT));
        this.data.plugins = Object.assign(UserController.getPluginsDefaultData(), this.data.plugins || {});
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
     * Set new password
     * @param newHashedPassword
     */
    public setHashedPassword(newHashedPassword: string): void {
        this.password = newHashedPassword;
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
            data: this.data,
            rank: User.getRankByXp(this.xp).images
        }
    }
}

