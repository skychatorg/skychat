/**
 * Plinko's rules, shared by the server (which draws every result) and the client (which animates it).
 * Money is in cents. Of each ball: 40% grows the jackpot, 50% pays the small wins on average, 10% goes to the house,
 * which pays each jackpot's restart: over the 2000 balls a jackpot takes on average, $1 × 2000 = the $2,000 restart.
 */
export const PLINKO = {
    ballPrice: 1000,
    toJackpot: 400,
    jackpotStart: 200_000,
    /** One ball in this many wins the jackpot */
    jackpotOdds: 2000,
    rows: 12,
} as const;

/** What each of the 13 slots pays, as a multiple of the ball: the slot is the number of rights in the ball's path */
export const PLINKO_SLOTS = ['jackpot', 5, 2, 1, 0.5, 0, 0, 0, 0.5, 1, 2, 5, 'jackpot'] as const;

export type PlinkoResult = (typeof PLINKO_SLOTS)[number];

/** The small wins, in basis points (1/10,000): 50% of the ball back on average */
export const PLINKO_SMALL_WINS: { multiplier: number; chance: number }[] = [
    { multiplier: 5, chance: 200 },
    { multiplier: 2, chance: 600 },
    { multiplier: 1, chance: 1400 },
    { multiplier: 0.5, chance: 2800 },
];

/** About 1 losing ball in 3 rides an edge for at least this many rows first, as if heading for the jackpot */
const TEASE_PERCENT = 30;
const MIN_HUG = 6;

/**
 * A path of `rows` moves (true = right) that lands in `slot`. Purely cosmetic: the result is drawn before it.
 * @param random A whole number in [0, max)
 */
export function plinkoPath(slot: number, random: (max: number) => number): boolean[] {
    const rows = PLINKO.rows;
    const rights = slot;
    const lefts = rows - slot;
    const jackpot = PLINKO_SLOTS[slot] === 'jackpot';
    const shuffled = (length: number, trues: number) => {
        const moves = Array.from({ length }, (_, i) => i < trues);
        for (let i = moves.length - 1; i > 0; i--) {
            const j = random(i + 1);
            [moves[i], moves[j]] = [moves[j], moves[i]];
        }
        return moves;
    };
    if (jackpot || (lefts < MIN_HUG && rights < MIN_HUG) || random(100) >= TEASE_PERCENT) {
        return shuffled(rows, rights);
    }
    // Hug a side that has the moves to spare, then spend the rest at random
    const right = lefts < MIN_HUG ? true : rights < MIN_HUG ? false : random(2) === 1;
    const hug = MIN_HUG + random((right ? rights : lefts) - MIN_HUG + 1);
    return [...Array<boolean>(hug).fill(right), ...shuffled(rows - hug, right ? rights - hug : rights)];
}

/** Base time per row, in ms. Rows ridden along an edge take longer, a bit more each row, for suspense */
const ROW_MS = 110;

/**
 * When the ball reaches each row, from its drop: `rows + 1` times in ms, the last one when it lands
 */
export function plinkoTimes(path: boolean[]): number[] {
    const times = [0];
    let rights = 0;
    path.forEach((right, row) => {
        const onEdge = row >= 3 && (rights === 0 || rights === row);
        times.push(times[row] + ROW_MS * (onEdge ? 1 + 0.12 * (row - 2) : 1));
        rights += right ? 1 : 0;
    });
    return times;
}

/** How long a ball takes from its drop to its slot, in ms */
export const plinkoFlightMs = (path: boolean[]): number => plinkoTimes(path)[path.length] + 150;
