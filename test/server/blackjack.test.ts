import { describe, expect, it } from 'vitest';
import { createShoe, dealerShouldHit, handValue, settle } from '../../app/server/plugins/player/casino/blackjack.js';
import { hand } from './cards.js';

describe('blackjack rules', () => {
    it('counts aces as 11 unless that busts', () => {
        expect(handValue(hand('A♠ 6♥'))).toEqual({ total: 17, soft: true });
        expect(handValue(hand('A♠ 6♥ 10♣'))).toEqual({ total: 17, soft: false });
        expect(handValue(hand('A♠ A♥ 9♣'))).toEqual({ total: 21, soft: true });
        expect(handValue(hand('K♠ Q♥ 5♣'))).toEqual({ total: 25, soft: false });
    });

    it('has the dealer stand on every 17, soft ones included', () => {
        expect(dealerShouldHit(hand('10♠ 6♥'))).toBe(true);
        expect(dealerShouldHit(hand('10♠ 7♥'))).toBe(false);
        expect(dealerShouldHit(hand('A♠ 6♥'))).toBe(false);
    });

    it('settles every outcome with the stake included in the payout', () => {
        expect(settle(hand('10♠ Q♥'), hand('10♣ 9♦'), 20)).toEqual({ outcome: 'win', payout: 40 });
        expect(settle(hand('10♠ 8♥'), hand('10♣ 8♦'), 20)).toEqual({ outcome: 'push', payout: 20 });
        expect(settle(hand('10♠ 7♥'), hand('10♣ 9♦'), 20)).toEqual({ outcome: 'lose', payout: 0 });
        expect(settle(hand('10♠ 7♥'), hand('10♣ 6♦ 9♠'), 20)).toEqual({ outcome: 'win', payout: 40 });
        expect(settle(hand('10♠ 7♥ 9♣'), hand('10♣ 6♦ 9♠'), 20)).toEqual({ outcome: 'bust', payout: 0 });
    });

    it('pays blackjack 3 to 2, rounded down to whole dollars', () => {
        expect(settle(hand('A♠ K♥'), hand('10♣ 9♦'), 20)).toEqual({ outcome: 'blackjack', payout: 50 });
        expect(settle(hand('A♠ K♥'), hand('10♣ 9♦'), 25)).toEqual({ outcome: 'blackjack', payout: 62 });
    });

    it('only counts a two-card 21 as blackjack', () => {
        expect(settle(hand('A♠ K♥'), hand('A♣ Q♦'), 20)).toEqual({ outcome: 'push', payout: 20 });
        expect(settle(hand('10♠ 9♥'), hand('A♣ Q♦'), 20)).toEqual({ outcome: 'lose', payout: 0 });
        expect(settle(hand('7♠ 7♥ 7♣'), hand('A♣ Q♦'), 20)).toEqual({ outcome: 'lose', payout: 0 });
        expect(settle(hand('7♠ 7♥ 7♣'), hand('10♣ 9♦'), 20)).toEqual({ outcome: 'win', payout: 40 });
    });

    it('shuffles a full deck of 52 distinct cards', () => {
        const shoe = createShoe();
        expect(new Set(shoe.map((c) => c.rank + c.suit)).size).toBe(52);
    });
});
