import { PluginGroup } from '../PluginGroup.js';
import { VoicePlugin } from './VoicePlugin.js';

export class VoicePluginGroup extends PluginGroup {
    roomPluginClasses = [];

    globalPluginClasses = [VoicePlugin];
}
