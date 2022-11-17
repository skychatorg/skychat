import { RoomPlugin } from '../../RoomPlugin';
import { Room } from '../../../skychat/Room';


export type EncryptedData = {
    iv: string;
    cipher: string;
};

/**
 * This plugin sole purpose is to store information about whether a room is ciphered.
 */
export class EncryptPlugin extends RoomPlugin {
    static readonly commandName = 'encrypt';

    static readonly commandAliases = [
        'encrypt-on',
        'encrypt-off'
    ];

    readonly rules = {
        'encrypt-on': {
            minCount: 2,
            maxCount: 2,
            coolDown: 5000,
            params: [
                { pattern: /.+/, name: 'iv' },
                { pattern: /.+/, name: 'cipher' },
            ]
        },
        'encrypt-off': {
            minCount: 0,
            maxCount: 0,
            coolDown: 5000,
        },
    };

    readonly opOnly = true;

    protected storage: null | EncryptedData = null;

    constructor(room: Room) {
        super(room);

        this.hydrateStorage();
    }

    async run(alias: string, param: string): Promise<void> {
        if (alias === 'encrypt-off') {
            this.storage = null;
        } else if (alias === 'encrypt-on') {
            const [iv, cipher] = param.split(' ');
            this.storage = { iv, cipher };
        } else {
            throw new Error('Unsupported command');
        }

        this.room.manager.broadcastRoomList();
        this.writeStorageToDisk();
    }

    /**
     * Tell users that get the room list whether this room is encrypted or not
     */
    public getRoomSummary() {
        return this.storage;
    }
}
