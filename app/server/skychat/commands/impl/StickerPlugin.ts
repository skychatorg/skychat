import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {Server} from "../../Server";
import {MessageFormatter} from "../../MessageFormatter";


export class StickerPlugin extends Plugin {

    readonly name = 'sticker';

    readonly aliases = ['stickeradd', 'stickerdel'];

    readonly minRight = 20;

    readonly rules = {
        sticker: { maxCount: 0 },
        stickeradd: {
            minCount: 2,
            maxCount: 2,
            params: [
                {name: 'code', pattern: /^:([a-z0-9]+):$/},
                {name: 'url', pattern: Server.UPLOADED_FILE_REGEXP}
            ]
        },
        stickerdel: {
            minCount: 1,
            maxCount: 1,
            params: [
                {name: 'code', pattern: /^:([a-z0-9]+):$/},
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
        const [code, url] = param.split(' ');
        this.formatter.addSticker(code, url);
    }

    /**
     * Delete a sticker
     * @param param
     * @param connection
     */
    private async handleStickerDelete(param: string, connection: Connection): Promise<void> {
        this.formatter.deleteSticker(param);
    }
}
