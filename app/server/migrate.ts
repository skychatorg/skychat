import * as sqlite from 'sqlite';
import * as sqlite3 from 'sqlite3';
import { DatabaseHelper } from './skychat/DatabaseHelper';
import SQL from 'sql-template-strings';

const SQLITE_DB_PATH = 'database.db';

function loadSQLite() {
    try {
        return sqlite.open({
            filename: SQLITE_DB_PATH,
            mode: sqlite3.OPEN_READONLY,
            driver: sqlite3.Database,
        });
    } catch (error) {
        throw new Error('No migration to do, SQLite database not found');
    }
}

(async () => {
    // Load new pg client
    await DatabaseHelper.load();

    // Also load old SQLite database
    const sqliteDb = await loadSQLite();

    // Empty the new database
    await DatabaseHelper.db.query('TRUNCATE TABLE users CASCADE');
    await DatabaseHelper.db.query('TRUNCATE TABLE messages CASCADE');

    // Migrate users
    console.log('Migrating users');
    const users = await sqliteDb.all('SELECT * FROM users');
    for (const user of users) {
        await DatabaseHelper.db.query(
            SQL`INSERT INTO users (
                id,
                username,
                username_custom,
                email,
                password,
                money,
                xp,
                "right",
                data,
                storage,
                tms_created,
                tms_last_seen
            )
            VALUES (
                ${user.id},
                ${user.username},
                ${user.username_custom},
                ${user.email},
                ${user.password},
                ${Math.round(user.money)},
                ${user.xp},
                ${user.right},
                ${user.data},
                ${user.storage},
                ${user.tms_created},
                ${user.tms_last_seen}
            )`,
        );
    }

    // Reset posgres sequence
    console.log('Resetting users sequence');
    await DatabaseHelper.db.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");

    // Migrate messages
    console.log('Migrating messages');
    const messages = await sqliteDb.all('SELECT * FROM messages');
    for (const message of messages) {
        await DatabaseHelper.db.query(
            SQL`INSERT INTO messages (
                id,
                room_id,
                user_id,
                quoted_message_id,
                content,
                date,
                ip
            )
            VALUES (
                ${message.id},
                ${message.room_id},
                ${message.user_id},
                ${message.quoted_message_id},
                ${message.content},
                TO_TIMESTAMP(${Math.round(message.date / 1000)}),
                ${message.ip}
            )`,
        );
    }

    // Reset posgres sequence
    console.log('Resetting messages sequence');
    await DatabaseHelper.db.query("SELECT setval('messages_id_seq', (SELECT MAX(id) FROM messages))");

    console.log('Done');
})();
