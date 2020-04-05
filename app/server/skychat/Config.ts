import * as fs from 'fs';


export class Config {

    public static USERS_PASSWORD_SALT: string = '';

    public static USERS_TOKEN_SALT: string = '';

    public static YOUTUBE_API_KEY: string = '';

    public static OP: string[] = [];

    public static initialize() {
        const config = JSON.parse(fs.readFileSync('.env.json').toString());
        Config.USERS_PASSWORD_SALT = config.users_passwords_salt;
        Config.USERS_TOKEN_SALT = config.users_token_salt;
        Config.YOUTUBE_API_KEY = config.youtube_api_key;
        Config.OP = config.op;
    }
}

Config.initialize();
