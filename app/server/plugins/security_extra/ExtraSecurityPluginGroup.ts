import { PluginGroup } from '../PluginGroup';
import { RoomProtectPlugin } from './RoomProtectPlugin';
import { HistoryClearPlugin } from './HistoryClearPlugin';
import { LogFuzzerPlugin } from './LogFuzzerPlugin';
import { TorBanPlugin } from './TorBanPlugin';
import { TrackerPlugin } from './TrackerPlugin';
import { UsurpPlugin } from './UsurpPlugin';
import { BunkerPlugin } from './BunkerPlugin';

export class ExtraSecurityPluginGroup extends PluginGroup {
    roomPluginClasses = [RoomProtectPlugin, HistoryClearPlugin, UsurpPlugin];

    globalPluginClasses = [BunkerPlugin, LogFuzzerPlugin, TorBanPlugin, TrackerPlugin];
}
