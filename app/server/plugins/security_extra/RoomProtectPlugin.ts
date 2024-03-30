import { UserController } from '../../skychat/UserController';
import { RoomPlugin } from '../RoomPlugin';
import { Room } from '../../skychat/Room';
import { Connection } from '../../skychat/Connection';

export class RoomProtectPlugin extends RoomPlugin {
    static readonly commandName = 'roomprotect';

    readonly opOnly = true;

    readonly rules = {
        roomprotect: {
            minCount: 1,
            maxCount: 3,
            params: [
                {
                    name: 'protection',
                    pattern: /^(off|\d+)$/,
                },
            ],
        },
    };

    /**
     * Min right to enter the room
     */
    protected storage: null | number = null;

    constructor(room: Room) {
        super(room);

        this.loadStorage();
    }

    async run(_alias: string, param: string): Promise<void> {
        await this.handleRoomProtect(param);
    }

    public getMinRight() {
        return this.storage === null ? -1 : this.storage;
    }

    public getRoomSummary() {
        return this.storage;
    }

    async handleRoomProtect(param: string) {
        if (param === 'off') {
            this.storage = null;
        } else if (!isNaN(parseInt(param, 10))) {
            this.storage = parseInt(param, 10);
        }
        this.syncStorage();

        this.room.sendMessage({
            content: 'Room as a new protection policy: ' + (this.storage === null ? 'No protection' : `Min right: ${this.storage}`),
            user: UserController.getNeutralUser(),
        });
    }

    public async onBeforeConnectionJoinedRoom(connection: Connection): Promise<void> {
        // If bunker mode not enabled, do nothing
        if (this.storage === null) {
            return;
        }

        if (connection.session.isOP()) {
            return;
        }

        if (connection.session.user.right >= this.storage) {
            return;
        }

        throw new Error('You do not have enough right to enter this room');
    }
}
