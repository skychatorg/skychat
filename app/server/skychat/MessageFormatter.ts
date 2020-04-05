import * as fs from 'fs';
import * as escapeHtml from "escape-html";
import {Config} from "./Config";


/**
 * Singleton helper to format messages
 */
export class MessageFormatter {

    public static readonly STICKERS_JSON: string = './stickers.json';

    private static instance?: MessageFormatter;

    public static getInstance(): MessageFormatter {
        if (! MessageFormatter.instance) {
            MessageFormatter.instance = new MessageFormatter();
        }
        return MessageFormatter.instance;
    }

    public stickers: {[code: string]: string} = {};

    constructor() {
        this.load();
    }

    /**
     * Format a raw message to html
     * @param message
     */
    public format(message: string): string {
        message = escapeHtml(message);
        message = this.replaceImages(message);
        message = this.replaceStickers(message);
        return message;
    }

    /**
     * Replace images
     * @param message
     */
    public replaceImages(message: string): string {
        const matches = message.match(new RegExp(Config.LOCATION + '/uploads/([-\\/._a-zA-Z0-9]+)', 'g'));
        if (! matches) {
            return message;
        }
        for (const imageUrl of matches) {
            const html = `<a href="${imageUrl}" target="_blank"><img class="skychat-image" src="${imageUrl}"></a>`;
            message = message.replace(new RegExp(imageUrl, 'g'), html);
        }
        return message;
    }

    /**
     * Replace stickers in a raw message
     * @param message
     */
    public replaceStickers(message: string): string {
        const matches = message.match(/:[a-z0-9-_]+:/g);
        if (! matches) {
            return message;
        }
        for (const code of matches) {
            const sticker = this.stickers[code];
            if (typeof sticker === 'undefined') {
                continue;
            }
            message = message.replace(new RegExp(code, 'g'), `<img class="skychat-sticker" src="${sticker}">`);
        }
        return message;
    }

    /**
     * Load stickers from storage
     */
    public load(): void {
        try {
            this.stickers = JSON.parse(fs.readFileSync(MessageFormatter.STICKERS_JSON).toString());
        } catch (e) {
            console.warn(e);
            this.stickers = {};
            this.save();
        }
    }

    /**
     * Save current sticker list to storage
     */
    public save(): void {
        fs.writeFileSync(MessageFormatter.STICKERS_JSON, JSON.stringify(this.stickers));
    }
}
