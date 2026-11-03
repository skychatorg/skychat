import { PluginGroup } from '../PluginGroup.js';
import { CasinoPlugin } from './CasinoPlugin.js';
import { PartyPlugin } from './PartyPlugin.js';
import { PlayerPlugin } from './PlayerPlugin.js';
import { YoutubeSearchAndPlayPlugin } from './YoutubeSearchAndPlayPlugin.js';

export class PlayerPluginGroup extends PluginGroup {
    roomPluginClasses = [];

    globalPluginClasses = [PlayerPlugin, YoutubeSearchAndPlayPlugin, CasinoPlugin, PartyPlugin];
}
