import { Connection } from "../../../Connection";
import { Room } from "../../../Room";
import { Message } from "../../../Message";
import { DatabaseHelper } from "../../../DatabaseHelper";
import { Plugin } from "../../Plugin";
import SQL from "sql-template-strings";


export class LogFuzzerPlugin extends Plugin {

    readonly name = 'logfuzzer';

    readonly minRight = -1;

    readonly rules = {
        logfuzzer: { }
    };

    /**
     * Last fuzzed message id in history
     */
    protected storage: number = 0;

    private tickTimeout?: NodeJS.Timeout;

    constructor(room: Room) {
        super(room);

        this.loadStorage();

        if (room) {
            this.tickTimeout = setInterval(this.tick.bind(this), 5 * 1000);
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        throw new Error('This plugin is not callable');        
    }

    private fuzzContent(content: string) {
        return content.replace(/(^| |,|\/|.)([a-z0-9-]+)/gi, (m0, m1, m2) => {
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

    async tick(): Promise<void> {
        const sqlQuery = SQL`select id, content from messages where id > ${this.storage}`;
        const messages: {content: string, id: number}[] = await DatabaseHelper.db.all(sqlQuery);
        for (const {id, content} of messages) {
            const sqlQuery = SQL`update messages set content=${this.fuzzContent(content)} where id=${id}`;
            await DatabaseHelper.db.run(sqlQuery);
        }
        const maxId = Math.max(...messages.map(message => message.id));
        this.storage = maxId;
        this.syncStorage();
    }
}
