import fs from 'fs';
import { Logging } from './Logging.js';

/**
 * Manages stickers
 */
export class StickerManager {
    public static readonly STICKERS_JSON: string = 'config/stickers.json';

    public static readonly STICKER_CODE_REGEXP: RegExp = /^:([a-z0-9-_)(]+):?$/;

    public static stickers: { [code: string]: string } = {};

    constructor() {
        throw new Error('Utility class');
    }

    /**
     * Load stickers from storage
     */
    public static loadStickers(): void {
        try {
            this.stickers = JSON.parse(fs.readFileSync(StickerManager.STICKERS_JSON).toString());
        } catch (e) {
            Logging.warn('stickers.json did NOT exist. It has been created automatically.');
            this.stickers = {};
            this.saveStickers();
        }
    }

    /**
     * Add a sticker
     * @param code
     * @param url
     */
    public static registerSticker(code: string, url: string): void {
        code = code.toLowerCase();
        if (typeof this.stickers[code] !== 'undefined') {
            throw new Error('This sticker already exist');
        }
        this.stickers[code] = url;
        this.saveStickers();
    }

    /**
     * Whether a sticker code is defined
     * @param code
     * @returns
     */
    public static stickerExists(code: string): boolean {
        return typeof this.stickers[code.toLowerCase()] !== 'undefined';
    }

    /**
     * Resolve a sticker code by allowing a few variations (missing leading / trailing colons, casing, etc)
     * @param code
     */
    public static resolveStickerCode(code: string): string | null {
        if (!code) {
            return null;
        }
        const trimmed = code.trim().toLowerCase();
        if (!trimmed) {
            return null;
        }

        const candidates = new Set<string>();
        candidates.add(trimmed);

        if (!trimmed.startsWith(':')) {
            candidates.add(`:${trimmed}`);
        } else if (trimmed.length > 1) {
            candidates.add(trimmed.slice(1));
        }

        if (!trimmed.endsWith(':')) {
            candidates.add(`${trimmed}:`);
        } else if (trimmed.length > 1) {
            candidates.add(trimmed.slice(0, -1));
        }

        let wrapped = trimmed;
        if (!wrapped.startsWith(':')) {
            wrapped = `:${wrapped}`;
        }
        if (!wrapped.endsWith(':')) {
            wrapped = `${wrapped}:`;
        }
        candidates.add(wrapped);

        for (const candidate of candidates) {
            if (this.stickerExists(candidate)) {
                return candidate.toLowerCase();
            }
        }

        return null;
    }

    /**
     * Delete a sticker
     * @param code
     */
    public static unregisterSticker(code: string): void {
        code = code.toLowerCase();
        if (typeof this.stickers[code] === 'undefined') {
            throw new Error('This sticker does not exist');
        }
        delete this.stickers[code];
        this.saveStickers();
    }

    /**
     * Get a sticker URL
     * @param code
     * @returns
     */
    public static getStickerUrl(code: string): string {
        return this.stickers[code];
    }

    /**
     * Save current sticker list to storage
     */
    public static saveStickers(): void {
        fs.writeFileSync(StickerManager.STICKERS_JSON, JSON.stringify(this.stickers));
    }
}

StickerManager.loadStickers();
