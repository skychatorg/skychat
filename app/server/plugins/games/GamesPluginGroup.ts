import { PluginGroup } from '../PluginGroup';
import { AprilFoolsDay } from './global/AprilFoolsDay';
import { CursorPlugin } from './global/CursorPlugin';
import { MoneyFarmerPlugin } from './global/MoneyFarmerPlugin';
import { OfferMoneyPlugin } from './global/OfferMoneyPlugin';
import { DailyRollPlugin } from './room/DailyRollPlugin';
import { GuessTheNumberPlugin } from './room/GuessTheNumberPlugin';
import { PointsCollectorPlugin } from './room/PointsCollectorPlugin';
import { GiveMoneyPlugin } from './room/GiveMoneyPlugin';
import { RacingPlugin } from './room/RacingPlugin';
import { RandomGeneratorPlugin } from './room/RandomGeneratorPlugin';
import { RollPlugin } from './room/RollPlugin';
import { StatsPlugin } from './room/StatsPlugin';
import { ConfusePlugin } from './global/ConfusePlugin';

export class GamesPluginGroup extends PluginGroup {
    roomPluginClasses = [DailyRollPlugin, GuessTheNumberPlugin, GiveMoneyPlugin, PointsCollectorPlugin, RacingPlugin, RandomGeneratorPlugin, RollPlugin, StatsPlugin];

    globalPluginClasses = [AprilFoolsDay, ConfusePlugin, CursorPlugin, MoneyFarmerPlugin, OfferMoneyPlugin];
}
