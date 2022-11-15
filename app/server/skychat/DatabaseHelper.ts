import * as sqlite from 'sqlite';
import * as sqlite3 from 'sqlite3';


const INSTALL_QUERY = `

DROP TABLE IF EXISTS \`users\`;

CREATE TABLE \`users\` (
  \`id\` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`username\` varchar(32) NOT NULL,
  \`username_custom\` varchar(32) NOT NULL,
  \`email\` varchar(128),
  \`password\` varchar(256) NOT NULL,
  \`money\` int NOT NULL,
  \`xp\` int NOT NULL,
  \`right\` int NOT NULL,
  \`data\` varchar(4096) NOT NULL,
  \`storage\` varchar(8192) DEFAULT '{}' NOT NULL,
  \`tms_created\` int NOT NULL,
  \`tms_last_seen\` int NOT NULL,
  CONSTRAINT username_unique UNIQUE(username)
);

DROP TABLE IF EXISTS \`messages\`;
CREATE TABLE \`messages\` (
  \`id\` INTEGER PRIMARY KEY NOT NULL,
  \`room_id\` INTEGER KEY NOT NULL,
  \`user_id\` INTEGER KEY NOT NULL,
  \`quoted_message_id\` INTEGER KEY DEFAULT NULL,
  \`content\` varchar(2048) NOT NULL,
  \`date\` datetime KEY NOT NULL DEFAULT '0000-00-00 00:00:00' DEFAULT CURRENT_TIMESTAMP,
  \`ip\` varchar(39) DEFAULT NULL
);

`;


/**
 * Helper class to interact with the database
 */
export class DatabaseHelper {

    /**
     * Db instance
     */
    static db: sqlite.Database;

    /**
     * Connect to the database
     */
    static async load(): Promise<void> {
        let db;
        try {
            // Try to open the database
            db = await sqlite.open({
                filename: 'storage/database.db',
                mode: sqlite3.OPEN_READWRITE,
                driver: sqlite3.Database
            });
        } catch (error) {
            console.warn('Database file missing: Creating a new one');
            // If it does not exist, create it
            db = await sqlite.open({
                filename: 'storage/database.db',
                mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
                driver: sqlite3.Database
            });
            // Install tables
            await db.exec(INSTALL_QUERY);
        }

        DatabaseHelper.db = db;
    }
}
