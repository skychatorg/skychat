import SQL from 'sql-template-strings';
import { Config } from '../../skychat/Config.js';
import { DatabaseHelper } from '../../skychat/DatabaseHelper.js';
import { Logging } from '../../skychat/Logging.js';
import { RoomManager } from '../../skychat/RoomManager.js';
import { GlobalPlugin } from '../GlobalPlugin.js';

export class LogFuzzerPlugin extends GlobalPlugin {
    static readonly DURATION_BEFORE_FUZZ = Config.PREFERENCES.daysBeforeMessageFuzz * 24 * 60 * 60 * 1000;

    static readonly FUZZ_COOLDOWN = Math.min(LogFuzzerPlugin.DURATION_BEFORE_FUZZ, 7 * 24 * 60 * 60 * 1000);

    static readonly BATCH_SIZE = 5000;

    /**
     * Delay before the first tick, so a restart does not postpone fuzzing by a full cooldown
     */
    static readonly FIRST_TICK_DELAY = 60 * 1000;

    static readonly commandName = 'logfuzzer';

    readonly callable = false;

    readonly hidden = true;

    /**
     * Last fuzzed message id in history
     */
    protected storage: { lastId: number } = { lastId: 0 };

    private tickTimeout?: NodeJS.Timeout;

    constructor(manager: RoomManager) {
        super(manager);

        this.loadStorage();
        this.armTick(LogFuzzerPlugin.FIRST_TICK_DELAY);
    }

    async run(): Promise<void> {
        throw new Error('Not implemented');
    }

    /**
     * Replace every letter and digit with a/A, keeping length, case and punctuation intact
     */
    private fuzzContent(content: string) {
        return content.replace(/[\p{L}\p{N}]/gu, (char) => (char === char.toUpperCase() ? 'A' : 'a'));
    }

    private armTick(duration: number) {
        this.tickTimeout && clearTimeout(this.tickTimeout);
        this.tickTimeout = setTimeout(this.tick.bind(this), duration);
    }

    async tick(): Promise<void> {
        const limitDate = new Date(new Date().getTime() - LogFuzzerPlugin.DURATION_BEFORE_FUZZ).toISOString();
        Logging.info('Fuzzing messages before', limitDate);
        try {
            let total = 0;
            let count = 0;
            do {
                count = await this.fuzzBatch(limitDate);
                total += count;
            } while (count === LogFuzzerPlugin.BATCH_SIZE);
            Logging.info('Fuzzed', total, 'messages');
        } catch (error) {
            Logging.error('Log fuzzing failed', error);
        } finally {
            this.armTick(LogFuzzerPlugin.FUZZ_COOLDOWN);
        }
    }

    /**
     * Fuzz a single batch of messages, moving the cursor forward. Returns the number of fuzzed messages.
     */
    private async fuzzBatch(limitDate: string): Promise<number> {
        const sqlQuery = SQL`select id, content from messages where id > ${this.storage.lastId} and date <= ${limitDate} order by id limit ${LogFuzzerPlugin.BATCH_SIZE}`;
        const messages: { content: string; id: number }[] = (await DatabaseHelper.db.query(sqlQuery)).rows;
        for (const { id, content } of messages) {
            await DatabaseHelper.db.query(SQL`update messages set content=${this.fuzzContent(content)} where id=${id}`);
        }
        if (messages.length > 0) {
            this.storage.lastId = messages[messages.length - 1].id;
            this.syncStorage();
        }
        return messages.length;
    }
}
