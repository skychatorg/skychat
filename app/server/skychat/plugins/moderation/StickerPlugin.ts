import {Connection} from "../../Connection";
import {GlobalPlugin} from "../../GlobalPlugin";
import {Server} from "../../Server";
import { FileManager } from "../../FileManager";
import * as fs from "fs";
import { Config } from "../../Config";
import { StickerManager } from "../../StickerManager";


export class StickerPlugin extends GlobalPlugin {

    static readonly commandName = 'sticker';

    static readonly commandAliases = ['stickeradd', 'stickerdel'];

    readonly minRight = 40;

    readonly rules = {
        sticker: { maxCount: 0 },
        stickeradd: {
            minCount: 2,
            maxCount: 2,
            params: [
                {name: 'code', pattern: StickerManager.STICKER_CODE_REGEXP},
                {name: 'url', pattern: Server.UPLOADED_FILE_REGEXP}
            ]
        },
        stickerdel: {
            minCount: 1,
            maxCount: 1,
            params: [
                {name: 'code', pattern: StickerManager.STICKER_CODE_REGEXP},
            ]
        }
    };

    /**
     * Main function for handling commands
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (alias === 'stickeradd') {
            await this.handleStickerAdd(param, connection);
            return;
        }

        if (alias === 'stickerdel') {
            await this.handleStickerDelete(param, connection);
            return;
        }
    }

    /**
     * Add a sticker
     * @param param
     * @param connection
     */
    private async handleStickerAdd(param: string, connection: Connection): Promise<void> {
        let [code, url] = param.split(' ');
        if (! FileManager.isUploadedFileUrl(url)) {
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
        const newStickerPath = 'stickers/' + code.replace(/:/g, '_') + '.' + extension;
        const newStickerUrl = Config.LOCATION + '/' + newStickerPath + '?' + new Date().getTime();
        fs.copyFileSync(localFilePath, newStickerPath);
        StickerManager.registerSticker(code, newStickerUrl);
    }

    /**
     * Delete a sticker
     * @param code
     * @param connection
     */
    private async handleStickerDelete(code: string, connection: Connection): Promise<void> {
        if (! StickerManager.stickerExists(code)) {
            throw new Error('Given sticker does not exist');
        }
        const stickerUrl = StickerManager.getStickerUrl(code);
        const stickerLocalPath = FileManager.getLocalPathFromFileUrl(stickerUrl);
        try {
            fs.unlinkSync(stickerLocalPath);
        } catch (error) { }
        StickerManager.unregisterSticker(code);
    }
}
