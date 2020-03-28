import * as sqlite from "sqlite";


/**
 * Helper class to interact with the database
 */
export class DatabaseHelper {

    /**
     * Db instance
     */
    static db: sqlite.Database;

    static async load(): Promise<void> {
        DatabaseHelper.db = await sqlite.open('./database.db');
    }
}
