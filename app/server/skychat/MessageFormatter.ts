import * as escapeHtml from "escape-html";
import {Config} from "./Config";
import { StickerManager } from './StickerManager';



/**
 * Singleton helper to format messages
 */
export class MessageFormatter {

    public static readonly LINK_REGEXP: RegExp = /(^|[ \n]|<br>)((http|https):\/\/[\w?=&.\/-;#~%+@,\[\]:!-]+(?![\w\s?&.\/;#~%"=+@,\[\]:!-]*>))/ig;

    private static instance?: MessageFormatter;

    /**
     * Escape a regexp
     * @param string
     */
    public static escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    /**
     * Get command name from the message
     * @param message
     */
    public static parseCommand(message: string): {param: string, commandName: string} {
        message = message.trim();
        const commandName = message.split(' ')[0].substr(1).toLowerCase();
        const param = message.substr(commandName.length + 2);
        return {param, commandName};
    }

    public static getInstance(): MessageFormatter {
        if (! MessageFormatter.instance) {
            MessageFormatter.instance = new MessageFormatter();
        }
        return MessageFormatter.instance;
    }

    /**
     * Format a raw message to html
     * @param message
     */
    public format(message: string, remove?: boolean, trusted?: boolean): string {
        message = this.replaceHtml(message);
        message = this.replaceNewlines(message, remove, trusted);
        message = this.replaceButtons(message, remove, trusted);
        message = this.replaceImages(message, remove, trusted);
        message = this.replaceRisiBankStickers(message, remove);
        message = this.replaceStickers(message, remove);
        message = this.replaceLinks(message, remove);
        return message;
    }

    /**
     * Escape html
     * @param message
     */
    public replaceHtml(message: string): string {
        return escapeHtml(message);
    }

    /**
     * Replace newlines with <br>
     * @param message
     * @param remove
     * @param trusted
     */
    public replaceNewlines(message: string, remove?: boolean, trusted?: boolean): string {
        if (remove) {
            return message.replace(/\n/g, ' ');
        }
        // If replacing newlines with html br
        if (trusted) {
            return message.replace(/\n/g, '<br>');
        }
        // If using max newlines / message
        let count = 0;
        return message.replace(/\n/g, () => {
            // If limit reached
            if (++ count > Config.PREFERENCES.maxNewlinesPerMessage) {
                return "\n";
            }
            // Otherwise, replace with br
            return '<br>';
        })
    }

    /**
     * Replace buttons
     * @param message
     * @param trusted
     */
    public replaceButtons(message: string, remove?: boolean, trusted?: boolean): string {
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
            if (remove) {
                // Remove the button
                message = message.replace(rawCode, '');
            } else {
                // Replace the button by its html code
                const buttonCode = this.getButtonHtml(codeDetail[1], codeDetail[2], trusted);
                message = message.replace(rawCode, buttonCode);
            }
        }
        return message;
    }

    /**
     * Get the html code of a button
     * @param title
     * @param action
     * @param escape
     * @param trusted
     */
    public getButtonHtml(title: string, action: string, trusted?: boolean) {
        // Escape title and actions to prevent XSS
        title = this.format(title, true);
        action = this.format(action, true);
        // Preview command if action is one
        if (action[0] === '/' && ! trusted) {
            title += ' <span class="skychat-button-info">(' + escapeHtml(action.split(' ')[0]) + ')</span>';
        }
        return `<button class="skychat-button" title="${action}" data-action="${action}" data-trusted="${trusted}">${title}</button>`;
    }

    /**
     * Replace images
     * @param message
     * @param remove
     * @param trusted Whether to limit the number of replacements
     */
    public replaceImages(message: string, remove?: boolean, trusted?: boolean): string {
        let matches = message.match(new RegExp(Config.LOCATION + '/uploads/all/([-\\/._a-zA-Z0-9]+)\\.(png|jpg|jpeg|gif)', 'g'));
        if (! matches) {
            return message;
        }
        matches = Array.from(new Set(matches));
        let replacedCount = 0;
        for (const imageUrl of matches) {
            const html = `<a class="skychat-image" href="${imageUrl}" target="_blank"><img src="${imageUrl}"></a>`;
            // If removing images
            if (remove) {
                // Remove all image urls without any limit
                message = message.replace(new RegExp(imageUrl, 'g'), '');
            } else {
                // If replacing images by html, replace within limit
                message = message.replace(new RegExp(imageUrl, 'g'), () => {
                    ++ replacedCount;
                    if (! trusted && replacedCount > Config.PREFERENCES.maxReplacedImagesPerMessage) {
                        return imageUrl;
                    }
                    return html;
                });
            }
            // If limit was reached when replacing this image, do not replace the next ones
            if (! trusted && replacedCount > Config.PREFERENCES.maxReplacedImagesPerMessage) {
                break;
            }
        }
        return message;
    }

    /**
     * Replace RisiBank images
     * @param message
     */
    public replaceRisiBankStickers(message: string, remove?: boolean): string {
        const risibankImageRegExp = /https:\/\/risibank.fr\/cache\/medias\/([0-9]+)\/([0-9]+)\/([0-9]+)\/([0-9]+)\/([\w]+)\.(jpg|jpeg|gif|png)/g;
        const replaceStr = '<a class="skychat-risibank-sticker" href="//risibank.fr/media/$4-media" target="_blank"><img src="//risibank.fr/cache/medias/$1/$2/$3/$4/$5.$6"></a>';
        if (remove) {
            return message.replace(risibankImageRegExp, '');
        }
        return message.replace(risibankImageRegExp, replaceStr);
    }

    /**
     * Replace stickers in a raw message
     * @param message
     */
    public replaceStickers(message: string, remove?: boolean): string {
        let replacedCount = 0;
        for (const code in StickerManager.stickers) {
            const sticker = StickerManager.stickers[code];
            if (remove) {
                message = message.replace(new RegExp(MessageFormatter.escapeRegExp(code), 'g'), '');
            } else {

                message = message.replace(new RegExp(MessageFormatter.escapeRegExp(code), 'g'), () => {
                    ++ replacedCount;
                    if (replacedCount > Config.PREFERENCES.maxReplacedStickersPerMessage) {
                        return code;
                    }
                    return `<img class="skychat-sticker" title="${code}" alt="${code}" src="${sticker}">`;
                });
                if (replacedCount > Config.PREFERENCES.maxReplacedStickersPerMessage) {
                    break;
                }
            }
        }
        return message;
    }

    /**
     * Replace links in the message
     * @param text
     */
    public replaceLinks(text: string, remove?: boolean): string {
        if (remove) {
            text = text.replace(MessageFormatter.LINK_REGEXP, '');
        } else {
            text = text.replace(MessageFormatter.LINK_REGEXP, '$1<a class="skychat-link" target="_blank" rel="nofollow noopener noreferrer" href="$2">$2</a>');
        }
        return text;
    }
}
