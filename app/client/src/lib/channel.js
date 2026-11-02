import { formatMoney } from '../../../api/money.ts';

/**
 * Icon of a player channel by kind
 */
export const channelIcon = (channel) => (channel.kind === 'casino' ? 'dice' : 'music');

/**
 * A casino table's bet limits, like "$10–$100"
 */
export const betLimits = ({ minBet, maxBet }) => `${formatMoney(minBet)}–${formatMoney(maxBet)}`;
