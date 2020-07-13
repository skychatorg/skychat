import * as fs from 'fs';
import * as Mail from "nodemailer/lib/mailer";


export type Preferences = {
    fakeMessages: string[],
    guestNames: string[],
}

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

    public static EMAIL_TRANSPORT: Mail | null = null;

    public static PREFERENCES: Preferences;

    public static isOP(identifier: string): boolean {
        return Config.OP.indexOf(identifier.toLowerCase()) >= 0;
    }

    public static getRandomGuestName(): string {
        const index = Math.floor(Math.random() * Config.PREFERENCES.guestNames.length);
        return Config.PREFERENCES.guestNames[index];
    }

    public static initialize() {
        const env = JSON.parse(fs.readFileSync('.env.json').toString());
        Config.LOCATION = env.location;
        Config.HOSTNAME = env.hostname;
        Config.PORT = env.port;
        Config.USE_SSL = !! env.ssl;
        if (Config.USE_SSL) {
            Config.SSL_CERTIFICATE = env.ssl.certificate;
            Config.SSL_CERTIFICATE_KEY = env.ssl.key;
        }
        Config.USERS_PASSWORD_SALT = env.users_passwords_salt;
        Config.USERS_TOKEN_SALT = env.users_token_salt;
        Config.YOUTUBE_API_KEY = env.youtube_api_key;
        Config.OP = env.op;
        if (typeof env.email_transport === 'object') {
            Config.EMAIL_TRANSPORT = env.email_transport;
        }
        Config.PREFERENCES = JSON.parse(fs.readFileSync('config.json').toString());
    }
}

Config.initialize();
