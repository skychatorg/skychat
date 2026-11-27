import { DatabaseHelper } from './skychat/DatabaseHelper.js';
import { Logging } from './skychat/Logging.js';
import { SkyChatServer } from './skychat/SkyChatServer.js';

// Last resort: a missed await must cost a log line, not the whole server and the bets in play
process.on('unhandledRejection', (error) => Logging.error('Unhandled rejection', error));

(async () => {
    Logging.info('Loading database');
    await DatabaseHelper.load();

    Logging.info('Starting server');
    const skyChatServer = new SkyChatServer();
    await skyChatServer.start();
})();
