import {Connection} from "../../Connection";
import {Plugin} from "../../Plugin";
import {Server} from "../../Server";
import {MessageFormatter} from "../../MessageFormatter";
import { FileManager } from "../../FileManager";
import * as fs from "fs";
import { Config } from "../../Config";


export class StickerPlugin extends Plugin {

    readonly name = 'sticker';

    readonly aliases = ['stickeradd', 'stickerdel'];

    readonly minRight = 40;

    readonly rules = {
        sticker: { maxCount: 0 },
        stickeradd: {
            minCount: 2,
            maxCount: 2,
            params: [
                {name: 'code', pattern: MessageFormatter.STICKER_CODE_REGEXP},
                {name: 'url', pattern: Server.UPLOADED_FILE_REGEXP}
            ]
        },
        stickerdel: {
            minCount: 1,
            maxCount: 1,
            params: [
                {name: 'code', pattern: MessageFormatter.STICKER_CODE_REGEXP},
            ]
        }
    };

    private readonly formatter: MessageFormatter = MessageFormatter.getInstance();

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
        if (this.formatter.stickerExists(code)) {
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
        this.formatter.registerSticker(code, newStickerUrl);
    }

    /**
     * Delete a sticker
     * @param code
     * @param connection
     */
    private async handleStickerDelete(code: string, connection: Connection): Promise<void> {
        if (! this.formatter.stickerExists(code)) {
            throw new Error('Given sticker does not exist');
        }
        const stickerUrl = this.formatter.getStickerUrl(code);
        const stickerLocalPath = FileManager.getLocalPathFromFileUrl(stickerUrl);
        try {
            fs.unlinkSync(stickerLocalPath);
        } catch (error) { }
        this.formatter.unregisterSticker(code);
    }
}
