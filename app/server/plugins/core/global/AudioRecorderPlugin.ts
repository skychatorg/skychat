import { GlobalPlugin } from '../../GlobalPlugin.js';
import { Connection } from '../../../skychat/Connection.js';
import { User } from '../../../skychat/User.js';
import { MessageFormatter } from '../../../skychat/MessageFormatter.js';
import { Config } from '../../../skychat/Config.js';
import { BinaryMessageTypes } from '../../../../api/BinaryMessageTypes.js';

export class AudioRecorderPlugin extends GlobalPlugin {
    // Maximum number of recordings to keep in memory
    public static MAX_RECORDING_CACHED = 32;

    // Max recording length
    public static MAX_BUFFER_LENGTH = 1048576;

    static readonly commandName = 'audio';

    readonly minRight = Config.PREFERENCES.minRightForAudioRecording;

    readonly rules = {
        audio: {
            minCount: 1,
            maxCount: 1,
            params: [{ name: 'audio id', pattern: /^[0-9]+$/, info: 'Id of the audio to play' }],
        },
    };

    private currentEntryId = 0;

    public entries: { [id: number]: { buffer: Buffer; user: User } } = {};

    /**
     * Send an audio recording to the client
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const entry = this.entries[parseInt(param)];
        if (!entry) {
            throw new Error('Audio entry not found');
        }
        connection.webSocket.send(entry.buffer);
    }

    /**
     * Cursors are sent in binary format to save bandwidth.
     */
    async onBinaryDataReceived(connection: Connection, messageType: number, data: Buffer): Promise<boolean> {
        if (messageType !== BinaryMessageTypes.AUDIO) {
            return false;
        }

        if (connection.session.user.right < Config.PREFERENCES.minRightForAudioRecording) {
            throw new Error('You do not have the permission to save audio files');
        }

        if (data.length > AudioRecorderPlugin.MAX_BUFFER_LENGTH) {
            throw new Error('Audio recording too long');
        }

        // Get current connection room
        const roomId = connection.roomId;
        if (roomId === null) {
            throw new Error('You need to be in a room to send audio files');
        }
        const room = this.manager.getRoomById(roomId);
        if (!room) {
            throw new Error('Room does not exist');
        }

        ++this.currentEntryId;

        // Send the message to the room
        const content = `[[play audio//audio ${this.currentEntryId}]]`;
        const message = await room.sendMessage({
            formatted: MessageFormatter.getInstance().replaceButtons(content, false, true),
            content: content,
            user: connection.session.user,
            connection,
            meta: {
                audio: this.currentEntryId,
            },
        });

        // Create new buffer entry, which will be sent as-is to the client
        // We preprend the message type and id to the audio file
        const buffer = Buffer.alloc(data.length + 4 + 2);
        // Add meta-data
        buffer.writeUInt16LE(messageType, 0);
        buffer.writeInt32LE(message.id, 2);
        // Add data
        data.copy(buffer, 6);

        // Save new binary buffer
        this.entries[this.currentEntryId] = {
            buffer: buffer,
            user: connection.session.user,
        };

        // Update last interaction dates
        connection.session.lastInteractionDate = new Date();
        if (!room.isPrivate) {
            connection.session.lastPublicMessageSentDate = new Date();
        }

        // Delete old entry
        delete this.entries[this.currentEntryId - AudioRecorderPlugin.MAX_RECORDING_CACHED];
        return true;
    }
}
