import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {Message} from "../../../Message";
import {RisiBank, Sticker} from "risibank";


export class RisiBankPlugin extends Plugin {

    readonly name = 'risibank';

    readonly minRight = 0;

    readonly callable = false;

    readonly hidden = true;

    private readonly risibank: RisiBank = new RisiBank();

    /**
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> { }

    /**
     * Intercept all messages and replace its content by a sticker if needed
     * @param message
     * @param connection
     */
    public async onBeforeMessageBroadcastHook(message: Message, connection?: Connection): Promise<Message> {
        if (! connection) {
            return message;
        }
        const matches = message.formatted.match(/#([a-zA-Z0-9 ]+)(\/([0-9]+))?$/);
        if (! matches) {
            return message;
        }
        const tags = matches[1].trim();
        const index = parseInt(matches[3] || '0');
        let stickers;
        try {
            stickers = await this.risibank.searchStickers(tags);
        } catch (e) {
            console.warn(e);
        }
        if (! stickers || stickers.length === 0) {
            return message;
        }
        const sticker = stickers[index] || stickers[0];
        const formatted = message.formatted.replace(matches[0], '') + ` <img class="skychat-sticker" src="${this.getRisiBankLink(sticker)}" title="${tags}" align="${tags}">`;
        message.edit(message.content, formatted);
        return message;
    }

    /**
     * Get the direct link to a specific sticker
     * @param sticker
     */
    private getRisiBankLink(sticker: Sticker) {
        return `https://risibank.fr/cache/stickers/d${Math.floor(sticker.id / 100)}/${sticker.id}-thumb.${sticker.ext}`;
    }
}
