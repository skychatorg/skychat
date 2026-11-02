import { Card } from '../../app/server/plugins/player/casino/blackjack.js';

/**
 * Cards from a short string: 'A♠ 10♥' → [{ rank: 'A', suit: '♠' }, { rank: '10', suit: '♥' }]
 */
export const hand = (s: string): Card[] => s.split(' ').map((c) => ({ rank: c.slice(0, -1), suit: c.slice(-1) }) as Card);
