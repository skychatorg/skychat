import { formatMoney } from '../../../api/money.ts';

export { minVotes, PARTY_GAMES } from '../../../api/party.ts';

/**
 * Icon of a player channel by kind
 */
export const channelIcon = (channel) => (channel.kind === 'party' ? 'dice' : 'music');

/** In cents. Dark enough for the chip's light label, and no two steps of the 1-2-5 ladder share a color */
const CHIP_COLORS = {
    100: '#6b7280',
    200: '#a87f16',
    500: '#c9452f',
    1000: '#2f6db0',
    2000: '#c2621f',
    5000: '#2e8655',
    10000: '#26222a',
    20000: '#b0457e',
    50000: '#6d3fb0',
    100000: '#a8801f',
    200000: '#1f8a93',
    500000: '#8b2b3a',
    1000000: '#3b4a7a',
};

/**
 * A chip's color from its value, like a real casino: the same amount always looks the same, at every table
 */
export const chipColor = (value) => CHIP_COLORS[value] ?? '#3b4a7a';

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
