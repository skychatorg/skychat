import { DatabaseHelper } from './skychat/DatabaseHelper';
import { RoomManager } from './skychat/RoomManager';

(async () => {
    console.log('Loading database');
    await DatabaseHelper.load();

    console.log('Starting server');
    new RoomManager();
})();
