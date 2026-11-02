/**
 * Blackjack rules, with no state, timers or I/O so they can be tested on fixed hands.
 * One deck, reshuffled every hand. The dealer stands on all 17s. Blackjack pays 3 to 2.
 */

export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export type Card = { rank: (typeof RANKS)[number]; suit: (typeof SUITS)[number] };

export type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';

/**
 * A freshly shuffled deck. Cards are drawn with pop().
 */
export function createShoe(random: () => number = Math.random): Card[] {
    const shoe: Card[] = SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
    for (let i = shoe.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }
    return shoe;
}

/**
 * Best total of a hand: aces count 11 unless that busts. Soft means an ace still counts 11.
 */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
    let total = 0;
    let aces = 0;
    for (const { rank } of cards) {
        if (rank === 'A') {
            total += 11;
            aces++;
        } else {
            total += ['J', 'Q', 'K'].includes(rank) ? 10 : Number(rank);
        }
    }
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return { total, soft: aces > 0 };
}

export function isBlackjack(cards: Card[]): boolean {
    return cards.length === 2 && handValue(cards).total === 21;
}

export function isBust(cards: Card[]): boolean {
    return handValue(cards).total > 21;
}

export function dealerShouldHit(cards: Card[]): boolean {
    return handValue(cards).total < 17;
}

/**
 * How a finished hand ends, and how much goes back to the player (stake included).
 * Money is whole dollars, so a 3 to 2 payout on an odd bet is rounded down.
 */
export function settle(player: Card[], dealer: Card[], bet: number): { outcome: Outcome; payout: number } {
    if (isBust(player)) {
        return { outcome: 'bust', payout: 0 };
    }
    const playerBlackjack = isBlackjack(player);
    const dealerBlackjack = isBlackjack(dealer);
    if (playerBlackjack && dealerBlackjack) {
        return { outcome: 'push', payout: bet };
    }
    if (playerBlackjack) {
        return { outcome: 'blackjack', payout: bet + Math.floor(bet * 1.5) };
    }
    if (dealerBlackjack) {
        return { outcome: 'lose', payout: 0 };
    }
    const playerTotal = handValue(player).total;
    const dealerTotal = handValue(dealer).total;
    if (dealerTotal > 21 || playerTotal > dealerTotal) {
        return { outcome: 'win', payout: bet * 2 };
    }
    if (playerTotal === dealerTotal) {
        return { outcome: 'push', payout: bet };
    }
    return { outcome: 'lose', payout: 0 };
}
