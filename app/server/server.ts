import { DatabaseHelper } from './skychat/DatabaseHelper.js';
import { Logging } from './skychat/Logging.js';
import { SkyChatServer } from './skychat/SkyChatServer.js';

(async () => {
    Logging.info('Loading database');
    await DatabaseHelper.load();

    Logging.info('Starting server');
    const skyChatServer = new SkyChatServer();
    skyChatServer.start();
})();
