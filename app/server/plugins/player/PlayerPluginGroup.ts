import { PluginGroup } from '../PluginGroup';
import { PlayerPlugin } from './PlayerPlugin';
import { YoutubeSearchAndPlayPlugin } from './YoutubeSearchAndPlayPlugin';

export class PlayerPluginGroup extends PluginGroup {
    roomPluginClasses = [];

    globalPluginClasses = [
        PlayerPlugin,
        YoutubeSearchAndPlayPlugin,
    ];
}
