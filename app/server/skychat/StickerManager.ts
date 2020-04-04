import * as fs from 'fs';



export class StickerManager {

    public static readonly STORAGE_PATH: string = './stickers.json';

    private static instance?: StickerManager;

    public static getInstance(): StickerManager {
        if (! StickerManager.instance) {
            StickerManager.instance = new StickerManager();
        }
        return StickerManager.instance;
    }

    public stickers: {[code: string]: string} = {};

    constructor() {
        this.load();
    }

    /**
     * Replace all stickers in a raw message
     * @param message
     */
    public format(message: string): string {
        const matches = message.match(/:[a-z0-9-_]+:/g);
        if (! matches) {
            return message;
        }
        for (const code of matches) {
            const sticker = this.stickers[code];
            if (typeof sticker === 'undefined') {
                continue;
            }
            message = message.replace(new RegExp(code, 'g'), `<img class="sticker" src="${sticker}">`);
        }
        return message;
    }

    /**
     * Load stickers from storage
     */
    public load(): void {
        try {
            this.stickers = JSON.parse(fs.readFileSync(StickerManager.STORAGE_PATH).toString());
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
        fs.writeFileSync(StickerManager.STORAGE_PATH, JSON.stringify(this.stickers));
    }
}
