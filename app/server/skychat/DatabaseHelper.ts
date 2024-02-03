import { Client } from 'pg';

const INSTALL_QUERY = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username varchar(32) NOT NULL,
  username_custom varchar(32) NOT NULL,
  email varchar(128),
  password varchar(256) NOT NULL,
  money int NOT NULL,
  xp int NOT NULL,
  "right" int NOT NULL,
  data varchar(4096) NOT NULL,
  storage varchar(8192) DEFAULT '{}'::varchar(8192) NOT NULL,
  tms_created int NOT NULL,
  tms_last_seen int NOT NULL,
  CONSTRAINT username_unique UNIQUE(username)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  quoted_message_id INTEGER DEFAULT NULL,
  content varchar(2048) NOT NULL,
  date timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  ip varchar(39) DEFAULT NULL
);

`;

/**
 * Helper class to interact with the database
 */
export class DatabaseHelper {
    /**
     * DB instance
     */
    static db: Client;

    /**
     * Connect to the database
     */
    static async load(): Promise<void> {
        const db = new Client({
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
            database: process.env.POSTGRES_DB,
            host: 'app_db',
            port: 5432,
        });
        await db.connect();
        await db.query(INSTALL_QUERY);

        DatabaseHelper.db = db;
    }
}
