import * as fs from 'fs';


export class Config {

    public static LOCATION: string = '';

    public static HOSTNAME: string = '';

    public static PORT: number = 8080;

    public static USE_SSL: boolean = false;

    public static SSL_CERTIFICATE: string = '';

    public static SSL_CERTIFICATE_KEY: string = '';

    public static USERS_PASSWORD_SALT: string = '';

    public static USERS_TOKEN_SALT: string = '';

    public static YOUTUBE_API_KEY: string = '';

    public static OP: string[] = [];

    public static initialize() {
        const config = JSON.parse(fs.readFileSync('.env.json').toString());
        Config.LOCATION = config.location;
        Config.HOSTNAME = config.hostname;
        Config.PORT = config.port;
        Config.USE_SSL = !! config.ssl;
        if (Config.USE_SSL) {
            Config.SSL_CERTIFICATE = config.ssl.certificate;
            Config.SSL_CERTIFICATE_KEY = config.ssl.key;
        }
        Config.USERS_PASSWORD_SALT = config.users_passwords_salt;
        Config.USERS_TOKEN_SALT = config.users_token_salt;
        Config.YOUTUBE_API_KEY = config.youtube_api_key;
        Config.OP = config.op;
    }
}

Config.initialize();
