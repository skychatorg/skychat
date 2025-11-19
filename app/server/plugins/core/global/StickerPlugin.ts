import fs from 'fs';
import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { FileManager } from '../../../skychat/FileManager.js';
import { HttpServer } from '../../../skychat/HttpServer.js';
import { Session } from '../../../skychat/Session.js';
import { StickerManager } from '../../../skychat/StickerManager.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export class StickerPlugin extends GlobalPlugin {
    static readonly commandName = 'sticker';

    static readonly commandAliases = ['stickeradd', 'stickerdel'];

    readonly minRight =
        typeof Config.PREFERENCES.minRightForStickerManagement === 'number' ? Config.PREFERENCES.minRightForStickerManagement : -1;

    readonly opOnly = Config.PREFERENCES.minRightForStickerManagement === 'op';

    readonly rules = {
        sticker: { maxCount: 0 },
        stickeradd: {
            minCount: 2,
            maxCount: 2,
            params: [
                { name: 'code', pattern: StickerManager.STICKER_CODE_REGEXP },
                { name: 'url', pattern: HttpServer.UPLOADED_FILE_REGEXP },
            ],
        },
        stickerdel: {
            minCount: 1,
            maxCount: 1,
            params: [{ name: 'code', pattern: StickerManager.STICKER_CODE_REGEXP }],
        },
    };

    /**
     * Main function for handling commands
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string): Promise<void> {
        if (alias === 'stickeradd') {
            await this.handleStickerAdd(param);
            return;
        }

        if (alias === 'stickerdel') {
            await this.handleStickerDelete(param);
            return;
        }
    }

    /**
     * Add a sticker
     * @param param
     * @param connection
     */
    private async handleStickerAdd(param: string): Promise<void> {
        const [code, url] = param.split(' ');
        if (!FileManager.isFileUrlUploaded(url)) {
            throw new Error('Given sticker is not an uploaded image');
        }
        if (StickerManager.stickerExists(code)) {
            throw new Error('Given sticker already exists');
        }
        const localFilePath = FileManager.getLocalPathFromFileUrl(url);
        const extension = FileManager.getFileExtension(localFilePath);
        if (['png', 'jpg', 'jpeg', 'gif'].indexOf(extension) === -1) {
            throw new Error('Extension not allowed');
        }
        const newStickerPath = 'uploads/stickers/' + code.replace(/:/g, '_') + '.' + extension;
        const newStickerUrl = Config.LOCATION + '/' + newStickerPath + '?' + new Date().getTime();
        fs.copyFileSync(localFilePath, newStickerPath);
        StickerManager.registerSticker(code, newStickerUrl);
        Session.send('sticker-list', StickerManager.stickers);
    }

    /**
     * Delete a sticker
     * @param code
     * @param connection
     */
    private async handleStickerDelete(code: string): Promise<void> {
        if (!StickerManager.stickerExists(code)) {
            throw new Error('Given sticker does not exist');
        }
        const stickerUrl = StickerManager.getStickerUrl(code);
        const stickerLocalPath = FileManager.getLocalPathFromFileUrl(stickerUrl);
        try {
            fs.unlinkSync(stickerLocalPath);
        } catch (error) {
            void 0;
        }
        StickerManager.unregisterSticker(code);
        Session.send('sticker-list', StickerManager.stickers);
    }

    async onNewConnection(connection: Connection): Promise<void> {
        connection.send('sticker-list', StickerManager.stickers);
    }
}
