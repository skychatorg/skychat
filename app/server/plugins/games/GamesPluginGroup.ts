import { PluginGroup } from '../PluginGroup.js';
import { AprilFoolsDay } from './global/AprilFoolsDay.js';
import { CursorPlugin } from './global/CursorPlugin.js';
import { MoneyFarmerPlugin } from './global/MoneyFarmerPlugin.js';
import { OfferMoneyPlugin } from './global/OfferMoneyPlugin.js';
import { DailyRollPlugin } from './room/DailyRollPlugin.js';
import { GuessTheNumberPlugin } from './room/GuessTheNumberPlugin.js';
import { PointsCollectorPlugin } from './room/PointsCollectorPlugin.js';
import { GiveMoneyPlugin } from './room/GiveMoneyPlugin.js';
import { RacingPlugin } from './room/RacingPlugin.js';
import { RandomGeneratorPlugin } from './room/RandomGeneratorPlugin.js';
import { RollPlugin } from './room/RollPlugin.js';
import { StatsPlugin } from './room/StatsPlugin.js';
import { ConfusePlugin } from './global/ConfusePlugin.js';
import { UserPollPlugin } from './room/UserPollPlugin.js';

export class GamesPluginGroup extends PluginGroup {
    roomPluginClasses = [
        DailyRollPlugin,
        GuessTheNumberPlugin,
        GiveMoneyPlugin,
        PointsCollectorPlugin,
        RacingPlugin,
        RandomGeneratorPlugin,
        RollPlugin,
        StatsPlugin,
    ];

    globalPluginClasses = [AprilFoolsDay, UserPollPlugin, ConfusePlugin, CursorPlugin, MoneyFarmerPlugin, OfferMoneyPlugin];
}
