import * as fs from 'fs';
import * as Mail from "nodemailer/lib/mailer";


export type Preferences = {
    ranks: {limit: number, images: {[size: string]: string}}[],
    plugins: string[],
    fakeMessages: string[],
    guestNames: string[],
}

export type PublicConfig = {
    ranks: {limit: number, images: {[size: string]: string}}[],
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

    public static getPlugins(): string[] {
        return Config.PREFERENCES.plugins;
    }

    public static toClient(): PublicConfig {
        return {
            ranks: Config.PREFERENCES.ranks,
        }
    }

    public static initialize() {
        const env = JSON.parse(fs.readFileSync('.env.json').toString());
        Config.LOCATION = env.location;
        Config.HOSTNAME = env.hostname;
        Config.PORT = parseInt(env.port);
        if (isNaN(Config.PORT)) {
            throw new Error('Invalid port specified in the .env.json file');
        }
        Config.USE_SSL = !! env.ssl;
        if (Config.USE_SSL) {
            Config.SSL_CERTIFICATE = env.ssl.certificate;
            Config.SSL_CERTIFICATE_KEY = env.ssl.key;
        }
        Config.USERS_PASSWORD_SALT = env.users_passwords_salt;
        if (Config.USERS_PASSWORD_SALT.length === 0) {
            throw new Error('Please set the password salt in the .env.json file before running the application');
        }
        Config.USERS_TOKEN_SALT = env.users_token_salt;
        if (Config.USERS_TOKEN_SALT.length === 0) {
            throw new Error('Please set the user token salt in the .env.json file before running the application');
        }
        Config.YOUTUBE_API_KEY = env.youtube_api_key;
        if (Config.YOUTUBE_API_KEY.length === 0) {
            throw new Error('Please set the youtube API key in the .env.json file before running the application');
        }
        Config.OP = env.op;
        if (Config.OP.length === 0) {
            console.warn('You did not define any OP user in the .env.json file. You will not be able to escalate user right unless you add your username in this file.');
        }
        if (typeof env.email_transport === 'object') {
            Config.EMAIL_TRANSPORT = env.email_transport;
        }
        Config.PREFERENCES = JSON.parse(fs.readFileSync('config.json').toString());
        const keys: string[] = ['fakeMessages', 'guestNames', 'plugins', 'ranks'];
        for (const key of keys) {
            if (typeof (Config.PREFERENCES as any)[key] === 'undefined') {
                throw new Error(`The field "${key}" is missing in the config.json file. Please copy the field from the config.json.template file to the config.json file.`);
            }
        }
    }
}

Config.initialize();
