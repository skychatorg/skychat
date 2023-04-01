import { PluginGroup } from '../PluginGroup';
import { EncryptPlugin } from './room/EncryptPlugin';



export class CryptoPluginGroup extends PluginGroup {
    roomPluginClasses = [
        EncryptPlugin,
    ];

    globalPluginClasses = [];
}
