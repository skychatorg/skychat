import { PluginGroup } from '../PluginGroup.js';
import { RoomProtectPlugin } from './RoomProtectPlugin.js';
import { HistoryClearPlugin } from './HistoryClearPlugin.js';
import { LogFuzzerPlugin } from './LogFuzzerPlugin.js';
import { TorBanPlugin } from './TorBanPlugin.js';
import { TrackerPlugin } from './TrackerPlugin.js';
import { UsurpPlugin } from './UsurpPlugin.js';
import { BunkerPlugin } from './BunkerPlugin.js';
import { MessageLimiterPlugin } from './MessageLimiterPlugin.js';

export class ExtraSecurityPluginGroup extends PluginGroup {
    roomPluginClasses = [MessageLimiterPlugin, RoomProtectPlugin, HistoryClearPlugin, UsurpPlugin];

    globalPluginClasses = [BunkerPlugin, LogFuzzerPlugin, TorBanPlugin, TrackerPlugin];
}
