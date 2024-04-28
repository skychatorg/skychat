import { DatabaseHelper } from './skychat/DatabaseHelper.js';
import { RoomManager } from './skychat/RoomManager.js';

(async () => {
    console.log('Loading database');
    await DatabaseHelper.load();

    console.log('Starting server');
    new RoomManager();
})();
