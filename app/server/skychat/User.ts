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
    rank: string;
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


    public static readonly RANK_LIMITS: {limit: number, rank: string}[] = [
        {limit: 1000000, rank: 'rank_7.png'},
        {limit: 300000, rank: 'rank_6.png'},
        {limit: 120000, rank: 'rank_5.png'},
        {limit: 40000, rank: 'rank_4.png'},
        {limit: 4000, rank: 'rank_3.png'},
        {limit: 800, rank: 'rank_2.png'},
        {limit: 200, rank: 'rank_1.png'},
        {limit: 0, rank: 'rank_0.png'},
    ];

    /**
     * Get the rank image of this user from an xp amount
     */
    static getRankByXp(xp: number): string {
        const entry = User
            .RANK_LIMITS
            .filter(entry => xp >= entry.limit)[0];
        return entry ? entry.rank : User.RANK_LIMITS[User.RANK_LIMITS.length - 1].rank;
    }

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
        this.data.plugins = Object.assign(_.cloneDeep(UserController.getPluginsDefaultData()), this.data.plugins || {});
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
            data: this.data,
            rank: User.getRankByXp(this.xp)
        }
    }
}

