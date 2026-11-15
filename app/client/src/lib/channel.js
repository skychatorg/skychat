import { formatMoney } from '../../../api/money.ts';

export { PARTY_GAMES } from '../../../api/party.ts';

/**
 * Icon of a player channel by kind
 */
export const channelIcon = (channel) => (channel.kind === 'party' ? 'dice' : 'music');

/**
 * Up to five bet chips between the table limits, on a 1-2-5 ladder: always the min and the max, the rest spread between.
 * $10–$100 gives 10 · 20 · 50 · 100, $10–$10,000 gives 10 · 100 · 500 · 1,000 · 10,000
 */
export const betChips = ({ minBet, maxBet }) => {
    const ladder = [];
    for (let unit = 1; unit <= maxBet; unit *= 10) {
        ladder.push(...[1, 2, 5].map((step) => step * unit).filter((value) => value > minBet && value < maxBet));
    }
    const between = ladder.length <= 3 ? ladder : [1, 2, 3].map((i) => ladder[Math.round((i * (ladder.length - 1)) / 4)]);
    return [...new Set([minBet, ...between, maxBet])];
};

/**
 * A blackjack table's bet limits, like "$10–$100"
 */
export const betLimits = ({ minBet, maxBet }) => `${formatMoney(minBet)}–${formatMoney(maxBet)}`;
