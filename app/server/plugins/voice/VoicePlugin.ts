import { Connection } from '../../skychat/Connection.js';
import { Logging } from '../../skychat/Logging.js';
import { RoomManager } from '../../skychat/RoomManager.js';
import { GlobalPlugin } from '../GlobalPlugin.js';
import { VoiceError } from './VoiceError.js';
import { VoiceSfu } from './VoiceSfu.js';

/**
 * One GlobalPlugin owning the in-process mediasoup SFU. Mirrors PlayerPlugin.
 *
 * NOTE: this is the Phase-1 boot shell. Channel management, signaling handlers,
 * rights and moderation are added in later phases.
 */
export class VoicePlugin extends GlobalPlugin {
    static readonly commandName = 'voice';

    static readonly commandAliases = [
        'voicechannelmanage',
        'voicechannel',
        'voicertpcaps',
        'voicetransport',
        'voiceconnect',
        'voiceproduce',
        'voiceconsume',
        'voicemute',
        'voicekick',
    ];

    static readonly defaultDataStorageValue: { channel: null | number } = { channel: null };

    public readonly sfu: VoiceSfu;

    constructor(manager: RoomManager) {
        super(manager);

        this.sfu = new VoiceSfu();
        this.sfu.init().catch((err) => {
            Logging.error('VoiceSfu init failed', err);
        });
    }

    // eslint-disable-next-line no-unused-vars
    public async run(_alias: string, _param: string, _connection: Connection): Promise<void> {
        throw new VoiceError('Voice is not available yet');
    }
}
