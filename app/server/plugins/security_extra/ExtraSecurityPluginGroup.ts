import { PluginGroup } from '../PluginGroup';
import { RoomProtectPlugin } from './RoomProtectPlugin';
import { HistoryClearPlugin } from './HistoryClearPlugin';
import { LogFuzzerPlugin } from './LogFuzzerPlugin';
import { TorBanPlugin } from './TorBanPlugin';
import { TrackerPlugin } from './TrackerPlugin';
import { UsurpPlugin } from './UsurpPlugin';

export class ExtraSecurityPluginGroup extends PluginGroup {
    roomPluginClasses = [RoomProtectPlugin, HistoryClearPlugin, UsurpPlugin];

    globalPluginClasses = [LogFuzzerPlugin, TorBanPlugin, TrackerPlugin];
}
