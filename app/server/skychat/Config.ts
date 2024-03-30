import fs from 'fs';
import * as Mail from 'nodemailer/lib/mailer';

export type Preferences = {
    minRightForPublicMessages: number;
    minRightForPrivateMessages: number;
    minRightForShortTermMessageHistory: number;
    minRightForMessageHistory: number;
    minRightForUserModeration: number | 'op';
    minRightForSetRight: number | 'op';
    minRightForAudioRecording: number;
    minRightForConnectedList: number;
    minRightForPolls: number;
    minRightForGalleryRead: number | 'op';
    minRightForGalleryWrite: number | 'op';
    minRightForGalleryDelete: number | 'op';
    minRightForPlayerAddMedia: number | 'op';
    minRightForPlayerManageSchedule: number | 'op';
    maxReplacedImagesPerMessage: number;
    maxReplacedRisiBankStickersPerMessage: number;
    maxReplacedStickersPerMessage: number;
    maxNewlinesPerMessage: number;
    maxConsecutiveMessages: number;
    maxMessageMergeDelayMin: number;
    daysBeforeMessageFuzz: number;
    invertedBlacklist: boolean;
    messagesCooldown: Array<[number, number]>;
};

export type PublicConfig = {
    galleryEnabled: boolean;
};

export class Config {
    public static LOCATION = process.env.PUBLIC_URL ?? '';

    public static HOSTNAME = '0.0.0.0';

    public static PORT = 80;

    public static USERS_PASSWORD_SALT = '';

    public static USERS_TOKEN_SALT = '';

    public static YOUTUBE_API_KEY = '';

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
            galleryEnabled: Config.PLUGIN_GROUP_NAMES.includes('GalleryPluginGroup'),
        };
    }

    public static initialize() {
        // Load env variables
        const env = JSON.parse(fs.readFileSync('.env.json').toString());
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
            console.warn(
                'You did not define any OP user in the .env.json file. You will not be able to escalate user right unless you add your username in this file.',
            );
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
        Config.GUEST_NAMES = fs
            .readFileSync('config/guestnames.txt')
            .toString()
            .trim()
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        if (Config.GUEST_NAMES.length === 0) {
            console.warn('No guest name found (guestnames.txt file is empty). Using default "Guest" username for all guests.');
            Config.GUEST_NAMES.push('Guest');
        }
        // Load fake messages
        Config.FAKE_MESSAGES = fs
            .readFileSync('config/fakemessages.txt')
            .toString()
            .trim()
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        if (Config.FAKE_MESSAGES.length === 0) {
            console.warn('No fake messages found (fakemessages.txt file is empty). Using a single empty fake message.');
            Config.GUEST_NAMES.push('');
        }
        // Load preferences.json
        Config.PREFERENCES = JSON.parse(fs.readFileSync('config/preferences.json').toString());
        const keys: string[] = [
            'minRightForPrivateMessages',
            'minRightForShortTermMessageHistory',
            'minRightForMessageHistory',
            'minRightForUserModeration',
            'minRightForSetRight',
            'minRightForAudioRecording',
            'minRightForConnectedList',
            'minRightForPolls',
            'minRightForGalleryRead',
            'minRightForGalleryWrite',
            'minRightForPlayerAddMedia',
            'minRightForPlayerManageSchedule',
            'maxReplacedImagesPerMessage',
            'maxReplacedStickersPerMessage',
            'maxNewlinesPerMessage',
            'maxConsecutiveMessages',
            'maxMessageMergeDelayMin',
            'daysBeforeMessageFuzz',
            'invertedBlacklist',
            'messagesCooldown',
        ];
        for (const key of keys) {
            if (typeof (Config.PREFERENCES as any)[key] === 'undefined') {
                throw new Error(
                    `The field "${key}" is missing in the preferences.json file. Please copy the field from the preferences.json.template file to the preferences.json file.`,
                );
            }
        }
    }
}

Config.initialize();
