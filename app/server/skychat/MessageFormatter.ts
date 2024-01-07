import { Config } from './Config';
import { StickerManager } from './StickerManager';
import escapeHTML from 'escape-html';

/**
 * Singleton helper to format messages
 */
export class MessageFormatter {
    public static readonly QUOTE_REGEXP: RegExp = /(^|[ \n]|<br>)@(\*?[a-zA-Z0-9-_]{2,30})/gi;

    public static readonly LINK_REGEXP: RegExp =
        /(^|[ \n]|<br>)((http|https):\/\/[\w?=&./-;#~%+@,[\]:!-]+(?![\w\s?&./;#~%"=+@,[\]:!-]*>))/gi;

    public static readonly LINK_TRUNCATE_LENGTH = 24;
    public static readonly LINK_PATHNAME_TRUNCATE_LENGTH = 14;
    public static readonly LINK_SEARCH_TRUNCATE_LENGTH = 10;

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
    public static parseCommand(message: string): { param: string; commandName: string } {
        message = message.trim();
        const commandName = message.split(' ')[0].substr(1).toLowerCase();
        const param = message.substr(commandName.length + 2);
        return { param, commandName };
    }

    public static getInstance(): MessageFormatter {
        if (!MessageFormatter.instance) {
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
        message = this.replaceGreenTexts(message);
        message = this.replaceNewlines(message, remove, trusted);
        message = this.replaceButtons(message, remove, trusted);
        message = this.replaceImages(message, remove, trusted);
        message = this.replaceRisiBankStickers(message, remove);
        message = this.replaceStickers(message, remove);
        message = this.replaceLinks(message, remove);
        message = this.replaceQuotes(message);
        return message;
    }

    /**
     * Escape html
     * @param message
     */
    public replaceHtml(message: string): string {
        return escapeHTML(message);
    }

    /**
     * Replace green text-style messages
     * @see https://knowyourmeme.com/memes/greentext-stories
     * @param message
     */
    public replaceGreenTexts(message: string): string {
        return message.replace(/(^|\n)&gt;(.+)/g, '$1<b style="color: #69d569">&gt;$2</b>');
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
            if (++count > Config.PREFERENCES.maxNewlinesPerMessage) {
                return '\n';
            }
            // Otherwise, replace with br
            return '<br>';
        });
    }

    /**
     * Replace buttons
     * @param message
     * @param trusted
     */
    public replaceButtons(message: string, remove?: boolean, trusted?: boolean): string {
        const regexStr = '\\[\\[(.+?)/(.+?)\\]\\]';
        const matches = message.match(new RegExp(regexStr, 'g'));
        if (!matches) {
            return message;
        }
        for (const rawCode of matches) {
            const codeDetail = rawCode.match(new RegExp(regexStr));
            if (!codeDetail) {
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
        if (action[0] === '/' && !trusted) {
            title += ' <span class="skychat-button-info">(' + escapeHTML(action.split(' ')[0]) + ')</span>';
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
        let matches: RegExpMatchArray | string[] | null = message.match(
            new RegExp(Config.LOCATION + '/uploads/all/([-\\/._a-zA-Z0-9]+)\\.(png|jpg|jpeg|gif)', 'g'),
        );
        if (!matches) {
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
                    if (!trusted && replacedCount >= Config.PREFERENCES.maxReplacedImagesPerMessage) {
                        return imageUrl;
                    }
                    ++replacedCount;
                    return html;
                });
            }
            // If limit was reached when replacing this image, do not replace the next ones
            if (!trusted && replacedCount >= Config.PREFERENCES.maxReplacedImagesPerMessage) {
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
        const risibankImageRegExp = /https:\/\/risibank.fr\/cache\/medias\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\w+)\.(jpg|jpeg|gif|png)/g;
        if (remove) {
            return message.replace(risibankImageRegExp, '');
        }
        let replacedCount = 0;
        return message.replace(risibankImageRegExp, (match, p1, p2, p3, p4, p5, p6) => {
            if (replacedCount >= Config.PREFERENCES.maxReplacedRisiBankStickersPerMessage) {
                return match;
            }
            ++replacedCount;
            return `<a class="skychat-risibank-sticker" href="//risibank.fr/media/${p4}-media" target="_blank"><img src="//risibank.fr/cache/medias/${p1}/${p2}/${p3}/${p4}/${p5}.${p6}"></a>`;
        });
    }

    /**
     * Replace stickers in a raw message
     * @param message
     */
    public replaceStickers(message: string, remove?: boolean): string {
        for (const code in StickerManager.stickers) {
            const sticker = StickerManager.stickers[code];
            if (remove) {
                message = message.replace(new RegExp(MessageFormatter.escapeRegExp(code), 'g'), '');
            } else {
                let replacedCount = 0;
                message = message.replace(new RegExp(MessageFormatter.escapeRegExp(code), 'g'), () => {
                    if (replacedCount >= Config.PREFERENCES.maxReplacedStickersPerMessage) {
                        return code;
                    }
                    ++replacedCount;
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
     * Replace an href with a human-friendly version
     */
    public beautifyHref(href: string): string {
        const beautifyProtocol = (protocol: string) => {
            if (protocol === 'https:') {
                return '';
            }
            return protocol + '//';
        };
        const beautifyPath = (path: string) => {
            if (path.length < MessageFormatter.LINK_PATHNAME_TRUNCATE_LENGTH) {
                return path;
            }
            const pathParts = path.split('/');
            const lastPart = pathParts[pathParts.length - 1];
            if (lastPart.length < MessageFormatter.LINK_PATHNAME_TRUNCATE_LENGTH && pathParts.length > 2) {
                return `/[..]/${lastPart}`;
            }
            return `/[..]${lastPart.substring(lastPart.length - MessageFormatter.LINK_PATHNAME_TRUNCATE_LENGTH + 4)}`;
        };

        const beautifySearch = (search: string) => {
            search = search.replace(/^\?/, '');
            if (search.length < MessageFormatter.LINK_SEARCH_TRUNCATE_LENGTH) {
                return `?${search}`;
            }
            return `?[..]${search.substring(search.length - MessageFormatter.LINK_SEARCH_TRUNCATE_LENGTH + 5)}`;
        };

        if (href.length < MessageFormatter.LINK_TRUNCATE_LENGTH) {
            return href;
        }
        try {
            const url = new URL(href);
            const protocol = beautifyProtocol(url.protocol);
            const path = beautifyPath(url.pathname);
            const search = beautifySearch(url.search);
            return `${protocol}${url.hostname}${path}${search}`;
        } catch (error) {
            return href;
        }
    }

    /**
     * Replace links in the message
     */
    public replaceLinks(text: string, remove?: boolean): string {
        if (remove) {
            text = text.replace(MessageFormatter.LINK_REGEXP, '');
        } else {
            text = text.replace(MessageFormatter.LINK_REGEXP, (_match, p1, fullHref) => {
                // Match domain vs path
                return `${p1}<a class="skychat-link" target="_blank" rel="nofollow noopener noreferrer" href="${fullHref}">${this.beautifyHref(
                    fullHref,
                )}</a>`;
            });
        }
        return text;
    }

    /**
     * Replace quotes in the message
     */
    public replaceQuotes(text: string): string {
        return text.replace(MessageFormatter.QUOTE_REGEXP, '<span class="skychat-quote" data-username="$2">@$2</span>');
    }
}
