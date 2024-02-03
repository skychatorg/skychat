import SQL from 'sql-template-strings';
import { DatabaseHelper } from '../../skychat/DatabaseHelper';
import { GlobalPlugin } from '../GlobalPlugin';
import { RoomManager } from '../../skychat/RoomManager';
import { Config } from '../../skychat/Config';

export class LogFuzzerPlugin extends GlobalPlugin {
    static readonly DURATION_BEFORE_FUZZ = Config.PREFERENCES.daysBeforeMessageFuzz * 24 * 60 * 60 * 1000;

    static readonly FUZZ_COOLDOWN = Math.min(LogFuzzerPlugin.DURATION_BEFORE_FUZZ, 7 * 24 * 60 * 60 * 1000);

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
        this.armTick(LogFuzzerPlugin.FUZZ_COOLDOWN);
    }

    async run(): Promise<void> {
        throw new Error('Not implemented');
    }

    private fuzzContent(content: string) {
        return content.replace(/(^| |,|\/|.)([a-z0-9àâçéèêëîïôûùüÿñæœ-]+)/gi, (m0, m1, m2) => {
            let newStr = '';
            for (const char of m2) {
                if (char === char.toUpperCase()) {
                    newStr += 'A';
                } else {
                    newStr += 'a';
                }
            }
            return m1 + newStr;
        });
    }

    private armTick(duration: number) {
        this.tickTimeout && clearTimeout(this.tickTimeout);
        this.tickTimeout = setTimeout(this.tick.bind(this), duration);
    }

    async tick(): Promise<void> {
        const limitTimestamp = Math.floor(new Date().getTime() - LogFuzzerPlugin.DURATION_BEFORE_FUZZ);
        const sqlQuery = SQL`select id, content from messages where id > ${this.storage.lastId} and date <= ${limitTimestamp} limit 5000`;
        const messages: { content: string; id: number }[] = (await DatabaseHelper.db.query(sqlQuery)).rows;
        for (const { id, content } of messages) {
            const sqlQuery = SQL`update messages set content=${this.fuzzContent(content)} where id=${id}`;
            await DatabaseHelper.db.query(sqlQuery);
        }
        if (messages.length > 0) {
            const maxId = Math.max(...messages.map((message) => message.id));
            this.storage.lastId = maxId;
            this.syncStorage();
        }
        this.armTick(LogFuzzerPlugin.FUZZ_COOLDOWN);
    }
}
