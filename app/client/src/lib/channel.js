import { formatMoney } from '../../../api/money.ts';

/**
 * Icon of a player channel by kind
 */
export const channelIcon = (channel) => (channel.kind === 'party' ? 'dice' : 'music');

/**
 * The games of a party channel, in lobby order
 */
export const PARTY_GAMES = {
    blackjack: { name: 'Blackjack', pitch: 'Up to 5 players against the house. 3:2 blackjack, the dealer stands on 17.' },
    luckypop: { name: 'Lucky Pop', pitch: 'A shared sky of balloons. Pay to pop one: money, nothing, or a nasty surprise.' },
    crash: { name: 'Crash', pitch: 'Bet, watch the multiplier climb, and cash out before it crashes.' },
    dailyroll: { name: 'Daily Roll', pitch: 'Once a day for the whole channel. Pick a free card, one of them holds $50.' },
};

/**
 * A blackjack table's bet limits, like "$10–$100"
 */
export const betLimits = ({ minBet, maxBet }) => `${formatMoney(minBet)}–${formatMoney(maxBet)}`;
