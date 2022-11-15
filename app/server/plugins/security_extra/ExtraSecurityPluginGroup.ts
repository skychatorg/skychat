import { PluginGroup } from '../PluginGroup';
import { HistoryClearPlugin } from './HistoryClearPlugin';
import { LogFuzzerPlugin } from './LogFuzzerPlugin';
import { TorBanPlugin } from './TorBanPlugin';
import { TrackerPlugin } from './TrackerPlugin';
import { UsurpPlugin } from './UsurpPlugin';


export class ExtraSecurityPluginGroup extends PluginGroup {
    roomPluginClasses = [
        HistoryClearPlugin,
        UsurpPlugin,
    ];

    globalPluginClasses = [
        LogFuzzerPlugin,
        TorBanPlugin,
        TrackerPlugin,
    ];
}
