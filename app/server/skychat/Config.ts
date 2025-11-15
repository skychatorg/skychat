import fs from 'fs';
import { Logging } from './Logging.js';

export type Preferences = {
    minRightForPublicMessages: number;
    minRightForPrivateMessages: number;
    minRightForMessageQuoting: number;
    minRightForUserMention: number;
    minRightForShortTermMessageHistory: number;
    minRightForMessageHistory: number;
    minRightForEncryptedMessages: number;
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

    public static PREFERENCES: Preferences;

    public static GUEST_NAMES: string[] = [];

    public static FAKE_MESSAGES: string[] = [];

    public static WELCOME_MESSAGE: string | null = null;

    public static getRandomGuestName(): string {
        const index = Math.floor(Math.random() * Config.GUEST_NAMES.length);
        return Config.GUEST_NAMES[index];
    }

    /**
     * If any data is to be known by the client, it should be sent here.
     */
    public static toClient(): PublicConfig {
        return {
            galleryEnabled: Boolean(process.env.ENABLED_PLUGINS?.includes('GalleryPluginGroup')),
        };
    }

    public static initialize() {
        // Load guest names
        Config.GUEST_NAMES = fs
            .readFileSync('config/guestnames.txt')
            .toString()
            .trim()
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        if (Config.GUEST_NAMES.length === 0) {
            Logging.warn('No guest name found (guestnames.txt file is empty). Using default "Guest" username for all guests.');
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
            Logging.warn('No fake messages found (fakemessages.txt file is empty). Using a single empty fake message.');
            Config.GUEST_NAMES.push('');
        }
        // Load welcome message
        try {
            Config.WELCOME_MESSAGE = fs.readFileSync('config/welcome.txt').toString().trim();
        } catch (e) {
            Logging.info('No welcome message found (welcome.txt file is missing). Will not display a welcome message.');
            Config.WELCOME_MESSAGE = null;
        }
        // Load preferences.json
        Config.PREFERENCES = JSON.parse(fs.readFileSync('config/preferences.json').toString());
        const keys: string[] = [
            'minRightForShortTermMessageHistory',
            'minRightForMessageHistory',
            'minRightForPrivateMessages',
            'minRightForMessageQuoting',
            'minRightForUserMention',
            'minRightForEncryptedMessages',
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
