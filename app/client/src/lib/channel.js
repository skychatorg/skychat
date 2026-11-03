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
};

/**
 * A blackjack table's bet limits, like "$10–$100"
 */
export const betLimits = ({ minBet, maxBet }) => `${formatMoney(minBet)}–${formatMoney(maxBet)}`;
