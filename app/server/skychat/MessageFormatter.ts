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
        message = this.replaceRisiBankStickers(message);
        message = this.replaceStickers(message);
        message = this.replaceLinks(message);
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
            const html = `<a class="skychat-image" href="${imageUrl}" target="_blank"><img src="${imageUrl}"></a>`;
            message = message.replace(new RegExp(imageUrl, 'g'), html);
        }
        return message;
    }

    /**
     * Replace RisiBank images
     * @param message
     */
    public replaceRisiBankStickers(message: string): string {
        return message.replace(/https:\/\/api.risibank.fr\/cache\/stickers\/d([0-9]+)\/([0-9]+)-([A-Za-z0-9-_\[\]]+?)\.(jpg|jpeg|gif|png)/g, '<a class="skychat-risibank-sticker" href="//risibank.fr/stickers/$2-0" target="_blank"><img src="//api.risibank.fr/cache/stickers/d$1/$2-$3.$4"></a>');
    }

    /**
     * Replace links in the message
     * @param text
     */
    public replaceLinks(text: string): string {
        let regExp = /(?:^|[ ])((http|https):\/\/[\w?=&.\/-;#~%-]+(?![\w\s?&.\/;#~%"=-]*>))/ig;
        text = text.replace(regExp, ($0, $1, $2, $3, $4, $5, $6) => {
            const start = $0[0] === 'h' ? '' : ' ';
            return `${start}<a class="skychat-link" target="_blank" rel="nofollow" href="${$1}">${$1}</a>`;
        });
        return text;
    }

    /**
     * Escape a regexp
     * @param string
     */
    public escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }


    /**
     * Replace stickers in a raw message
     * @param message
     */
    public replaceStickers(message: string): string {
        for (const code in this.stickers) {
            const sticker = this.stickers[code];
            message = message.replace(new RegExp(this.escapeRegExp(code), 'g'), `<img class="skychat-sticker" title="${code}" alt="${code}" src="${sticker}">`);
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
