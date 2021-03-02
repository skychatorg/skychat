import * as fs from 'fs';
import * as escapeHtml from "escape-html";
import {Config} from "./Config";



/**
 * Singleton helper to format messages
 */
export class MessageFormatter {

    public static readonly STICKERS_JSON: string = './stickers.json';

    public static readonly STICKER_CODE_REGEXP: RegExp = /^:([a-z0-9-_)(]+):?$/;

    private static instance?: MessageFormatter;

    public static getInstance(): MessageFormatter {
        if (! MessageFormatter.instance) {
            MessageFormatter.instance = new MessageFormatter();
        }
        return MessageFormatter.instance;
    }

    public stickers: {[code: string]: string} = {};

    constructor() {
        this.loadStickers();
    }

    /**
     * Format a raw message to html
     * @param message
     */
    public format(message: string): string {
        message = escapeHtml(message);
        message = message.replace(/\n/g, "<br>");
        message = this.replaceButtons(message, false);
        message = this.replaceImages(message);
        message = this.replaceRisiBankStickers(message);
        message = this.replaceStickers(message);
        message = this.replaceLinks(message);
        return message;
    }

    /**
     * Replace buttons
     * @param message
     * @param trusted
     */
    public replaceButtons(message: string, trusted: boolean): string {
        const regexStr = '\\[\\[(.+?)\/(.+?)\\]\\]';
        const matches = message.match(new RegExp(regexStr, 'g'));
        if (! matches) {
            return message;
        }
        for (const rawCode of matches) {
            const codeDetail = rawCode.match(new RegExp(regexStr));
            if (! codeDetail) {
                // Weird: not supposed to happen
                continue;
            }
            const buttonCode = this.getButtonHtml(codeDetail[1], codeDetail[2], true, trusted);
            message = message.replace(rawCode, buttonCode);
        }
        return message;
    }

    /**
     * Replace images
     * @param message
     */
    public replaceImages(message: string, remove?: boolean): string {
        let matches = message.match(new RegExp(Config.LOCATION + '/uploads/([-\\/._a-zA-Z0-9]+)\\.(png|jpg|jpeg|gif)', 'g'));
        if (! matches) {
            return message;
        }
        matches = Array.from(new Set(matches));
        for (const imageUrl of matches) {
            const html = `<a class="skychat-image" href="${imageUrl}" target="_blank"><img src="${imageUrl}"></a>`;
            message = message.replace(new RegExp(imageUrl, 'g'), remove ? '' : html);
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
    public replaceLinks(text: string, remove?: boolean): string {
        let regExp = /(?:^|[ ])((http|https):\/\/[\w?=&.\/-;#~%+@,\[\]:!-]+(?![\w\s?&.\/;#~%"=+@,\[\]:!-]*>))/ig;
        if (remove) {
            text = text.replace(regExp, '');
        } else {
            text = text.replace(regExp, ($0, $1, $2, $3, $4, $5, $6) => {
                const start = $0[0] === 'h' ? '' : ' ';
                return `${start}<a class="skychat-link" target="_blank" rel="nofollow" href="${$1}">${$1}</a>`;
            });
        }
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
     * Get the html code of a button
     * @param title
     * @param action
     * @param escape
     * @param trusted
     */
    public getButtonHtml(title: string, action: string, escape: boolean, trusted: boolean) {
        if (escape) {
            title = escapeHtml(title);
            action = escapeHtml(action);
            action = this.replaceLinks(action, true);
            action = this.replaceImages(action, true);
            action = this.replaceStickers(action, true);
        }
        if (action[0] === '/' && ! trusted) {
            title += ' <span class="skychat-button-info">(' + escapeHtml(action.split(' ')[0]) + ')</span>';
        }
        return `<button class="skychat-button" title="${action}" data-action="${action}">${title}</button>`;
    }

    /**
     * Replace stickers in a raw message
     * @param message
     */
    public replaceStickers(message: string, remove?: boolean): string {
        for (const code in this.stickers) {
            const sticker = this.stickers[code];
            message = message.replace(new RegExp(this.escapeRegExp(code), 'g'), remove ? '' : `<img class="skychat-sticker" title="${code}" alt="${code}" src="${sticker}">`);
        }
        return message;
    }

    /**
     * Load stickers from storage
     */
    public loadStickers(): void {
        try {
            this.stickers = JSON.parse(fs.readFileSync(MessageFormatter.STICKERS_JSON).toString());
        } catch (e) {
            console.warn("stickers.json did NOT exist. It has been created automatically.");
            this.stickers = {};
            this.saveStickers();
        }
    }

    /**
     * Add a sticker
     * @param code
     * @param url
     */
    public addSticker(code: string, url: string): void {
        code = code.toLowerCase();
        if (typeof this.stickers[code] !== 'undefined') {
            throw new Error('This sticker already exist');
        }
        this.stickers[code] = url;
        this.saveStickers();
    }

    /**
     * Delete a sticker
     * @param code
     */
    public deleteSticker(code: string): void {
        code = code.toLowerCase();
        if (typeof this.stickers[code] === 'undefined') {
            throw new Error('This sticker does not exist');
        }
        delete this.stickers[code];
        this.saveStickers();
    }

    /**
     * Save current sticker list to storage
     */
    public saveStickers(): void {
        fs.writeFileSync(MessageFormatter.STICKERS_JSON, JSON.stringify(this.stickers));
    }
}
