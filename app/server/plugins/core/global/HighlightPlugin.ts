import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { Session } from '../../../skychat/Session.js';
import { StickerManager } from '../../../skychat/StickerManager.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

/** Manages the highlighted words list; the highlight and hover sticker burst are applied client-side */
export class HighlightPlugin extends GlobalPlugin {
    static readonly commandName = 'highlight';

    static readonly WORD_REGEXP: RegExp = /^[\p{L}\p{N}-]{2,32}$/u;

    readonly minRight =
        typeof Config.PREFERENCES.minRightForHighlightManagement === 'number' ? Config.PREFERENCES.minRightForHighlightManagement : -1;

    readonly opOnly = (Config.PREFERENCES.minRightForHighlightManagement ?? 'op') === 'op';

    readonly rules = {
        highlight: {
            minCount: 2,
            maxCount: 3,
            params: [
                { name: 'action', pattern: /^(add|del)$/ },
                { name: 'word', pattern: HighlightPlugin.WORD_REGEXP },
                { name: 'sticker', pattern: StickerManager.STICKER_CODE_REGEXP },
            ],
        },
    };

    /** Highlighted word (lowercase) to sticker code */
    protected storage: Record<string, string> = {};

    constructor(manager: RoomManager) {
        super(manager);

        this.loadStorage();
    }

    async run(_alias: string, param: string): Promise<void> {
        const [action, word, sticker] = param.split(' ');
        if (action === 'add') {
            this.handleAdd(word.toLowerCase(), sticker);
        } else {
            this.handleDel(word.toLowerCase());
        }
    }

    private handleAdd(word: string, sticker: string): void {
        const stickerCode = StickerManager.resolveStickerCode(sticker);
        if (!stickerCode) {
            throw new Error('Given sticker does not exist');
        }
        this.storage[word] = stickerCode;
        this.syncStorage();
        Session.send('highlight-list', this.storage);
    }

    private handleDel(word: string): void {
        if (typeof this.storage[word] === 'undefined') {
            throw new Error('Given word is not highlighted');
        }
        delete this.storage[word];
        this.syncStorage();
        Session.send('highlight-list', this.storage);
    }

    async onNewConnection(connection: Connection): Promise<void> {
        connection.send('highlight-list', this.storage);
    }
}
