/**
 * Roulette's rules, shared by the server (which spins and pays) and the client (which shows the wheel and the table).
 * A European wheel: 37 pockets, a single zero. Every bet returns 36/37 of its stake on average: the house keeps 2.7%.
 */

/** The pockets in their order around the wheel, from the zero */
export const WHEEL = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3,
    26,
];

const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const pocketColor = (n: number): 'green' | 'red' | 'black' => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

/**
 * A place to bet: the numbers 0 to 36 are their own spaces, the outside bets follow.
 * Sent as a number, since the party command only carries numbers.
 */
export type RouletteSpace = { id: number; label: string; covers: (n: number) => boolean; pays: number };

const outside = (id: number, label: string, covers: (n: number) => boolean, pays: number): RouletteSpace => ({ id, label, covers, pays });

export const ROULETTE_SPACES: RouletteSpace[] = [
    ...Array.from({ length: 37 }, (_, n) => outside(n, String(n), (result) => result === n, 35)),
    outside(37, 'Red', (n) => pocketColor(n) === 'red', 1),
    outside(38, 'Black', (n) => pocketColor(n) === 'black', 1),
    outside(39, 'Odd', (n) => n !== 0 && n % 2 === 1, 1),
    outside(40, 'Even', (n) => n !== 0 && n % 2 === 0, 1),
    outside(41, '1–18', (n) => n >= 1 && n <= 18, 1),
    outside(42, '19–36', (n) => n >= 19, 1),
    outside(43, '1st 12', (n) => n >= 1 && n <= 12, 2),
    outside(44, '2nd 12', (n) => n >= 13 && n <= 24, 2),
    outside(45, '3rd 12', (n) => n >= 25, 2),
];

/** What a bet on `space` gives back when the ball lands on `result`, stake included: 0 when it loses */
export const roulettePayout = (space: number, amount: number, result: number): number => {
    const bet = ROULETTE_SPACES[space];
    return bet && bet.covers(result) ? amount * (bet.pays + 1) : 0;
};
