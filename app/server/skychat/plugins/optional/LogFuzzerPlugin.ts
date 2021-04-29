import { Connection } from "../../Connection";
import { Room } from "../../Room";
import { DatabaseHelper } from "../../DatabaseHelper";
import { Plugin } from "../../Plugin";
import SQL from "sql-template-strings";


export class LogFuzzerPlugin extends Plugin {

    static readonly DURATION_BEFORE_FUZZ =  6 * 60 * 60 * 1000;

    static readonly FUZZ_COOLDOWN =  LogFuzzerPlugin.DURATION_BEFORE_FUZZ;

    readonly name = 'logfuzzer';

    readonly callable = false;

    readonly hidden = true;

    /**
     * Last fuzzed message id in history
     */
    protected storage: {lastId: number} = {lastId: 0};

    private tickTimeout?: NodeJS.Timeout;

    constructor(room: Room) {
        super(room);

        if (room) {
            this.loadStorage();
            this.armTick(LogFuzzerPlugin.FUZZ_COOLDOWN);
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> { }

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
        const sqlQuery = SQL`select id, content from messages where room_id = ${this.room.id} and id > ${this.storage.lastId} and date <= ${limitTimestamp} limit 5000`;
        const messages: {content: string, id: number}[] = await DatabaseHelper.db.all(sqlQuery);
        for (const {id, content} of messages) {
            const sqlQuery = SQL`update messages set content=${this.fuzzContent(content)} where id=${id}`;
            await DatabaseHelper.db.run(sqlQuery);
        }
        if (messages.length > 0) {
            const maxId = Math.max(...messages.map(message => message.id));
            this.storage.lastId = maxId;
            this.syncStorage();
        }
        this.armTick(LogFuzzerPlugin.FUZZ_COOLDOWN);
    }
}
