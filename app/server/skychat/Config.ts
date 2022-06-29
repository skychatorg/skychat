import * as fs from 'fs';
import * as Mail from "nodemailer/lib/mailer";


export type Preferences = {
    minRightForMessageHistory: number;
    minRightForPrivateMessages: number;
    minRightForAudioRecording: number;
    minRightForConnectedList: number;
    minRightForPolls: number;
    minRightForGalleryRead: number | 'op';
    minRightForGalleryWrite: number | 'op';
    minRightForGalleryDelete: number | 'op';
    minRightForPlayerAddMedia: number | 'op';
    minRightForPlayerManageSchedule: number | 'op';
    maxReplacedImagesPerMessage: number;
    maxReplacedStickersPerMessage: number;
    maxNewlinesPerMessage: number;
}

export type PublicConfig = {
    
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

    public static OP_PASSCODE: string | null = null;

    public static EMAIL_TRANSPORT: Mail | null = null;

    public static PREFERENCES: Preferences;
    
    public static GUEST_NAMES: string[] = [];

    public static FAKE_MESSAGES: string[] = [];

    public static PLUGIN_GROUP_NAMES: string[] = [];

    public static isInOPList(identifier: string): boolean {
        return Config.OP.indexOf(identifier.toLowerCase()) >= 0;
    }

    public static getRandomGuestName(): string {
        const index = Math.floor(Math.random() * Config.GUEST_NAMES.length);
        return Config.GUEST_NAMES[index];
    }

    /**
     * If any data is to be known by the client, it should be sent here.
     */
    public static toClient(): PublicConfig {
        return {

        }
    }

    public static initialize() {
        // Load env variables
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
        Config.PLUGIN_GROUP_NAMES = env.plugins;
        Config.USERS_PASSWORD_SALT = env.users_passwords_salt;
        if (Config.USERS_PASSWORD_SALT.length === 0) {
            throw new Error('Please set the password salt in the .env.json file before running the application.');
        }
        Config.USERS_TOKEN_SALT = env.users_token_salt;
        if (Config.USERS_TOKEN_SALT.length === 0) {
            throw new Error('Please set the user token salt in the .env.json file before running the application.');
        }
        Config.YOUTUBE_API_KEY = env.youtube_api_key;
        if (Config.YOUTUBE_API_KEY.length === 0) {
            console.warn('The Youtube API key is NOT set in the .env.json file. You will not be able to play youtube videos.');
        }
        Config.OP = env.op;
        if (Config.OP.length === 0) {
            console.warn('You did not define any OP user in the .env.json file. You will not be able to escalate user right unless you add your username in this file.');
        }
        Config.OP_PASSCODE = env.op_passcode;
        if (typeof Config.OP_PASSCODE !== 'string') {
            console.warn('You did not define a passcode for OP activation. It is recommended to add one in the .env.json file.');
            Config.OP_PASSCODE = null;
        }
        if (typeof env.email_transport === 'object') {
            Config.EMAIL_TRANSPORT = env.email_transport;
        }
        // Load guest names
        Config.GUEST_NAMES = fs.readFileSync('config/guestnames.txt').toString().trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);
        if (Config.GUEST_NAMES.length === 0) {
            console.warn('No guest name found (guestnames.txt file is empty). Using default "Guest" username for all guests.');
            Config.GUEST_NAMES.push('Guest');
        }
        // Load fake messages
        Config.FAKE_MESSAGES = fs.readFileSync('config/fakemessages.txt').toString().trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);
        if (Config.FAKE_MESSAGES.length === 0) {
            console.warn('No fake messages found (fakemessages.txt file is empty). Using a single empty fake message.');
            Config.GUEST_NAMES.push('');
        }
        // Load preferences.json
        Config.PREFERENCES = JSON.parse(fs.readFileSync('config/preferences.json').toString());
        const keys: string[] = [
            'minRightForMessageHistory',
            'minRightForPrivateMessages',
            'minRightForAudioRecording',
            'minRightForConnectedList',
            'minRightForPolls',
            'minRightForGalleryRead',
            'minRightForGalleryWrite',
            'minRightForPlayerAddMedia',
            'minRightForPlayerManageSchedule',
            'maxReplacedImagesPerMessage',
            'maxReplacedStickersPerMessage',
            'maxNewlinesPerMessage'
        ];
        for (const key of keys) {
            if (typeof (Config.PREFERENCES as any)[key] === 'undefined') {
                throw new Error(`The field "${key}" is missing in the preferences.json file. Please copy the field from the preferences.json.template file to the preferences.json file.`);
            }
        }
    }
}

Config.initialize();
