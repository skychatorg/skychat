import { DatabaseHelper } from './skychat/DatabaseHelper.js';
import { SkyChatServer } from './skychat/SkyChatServer.js';

(async () => {
    console.log('Loading database');
    await DatabaseHelper.load();

    console.log('Starting server');
    const skyChatServer = new SkyChatServer();
    skyChatServer.start();
})();
