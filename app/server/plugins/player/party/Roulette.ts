import { randomInt } from 'node:crypto';
import { formatMoney } from '../../../../api/money.js';
import { ROULETTE_SPACES, roulettePayout } from '../../../../api/roulette.js';
import { Connection } from '../../../skychat/Connection.js';
import { logFailure } from '../../../skychat/Logging.js';
import { Session } from '../../../skychat/Session.js';
import { UserController } from '../../../skychat/UserController.js';
import type { Party } from './Party.js';
import { PartyRound } from './PartyRound.js';

export type RoulettePhase = 'betting' | 'spinning' | 'results';

type Bet = { space: number; amount: number };

export type SanitizedRoulette = {
    channelId: number;
    phase: RoulettePhase;
    /** When betting closes, or when the results make way for the next spin */
    deadline: number;
    /** The pocket the ball lands in, from the start of the spin: bets are closed by then */
    result: number | null;
    spinStartedAt: number | null;
    spinMs: number;
    /** Last results, newest first */
    history: number[];
    /** Everyone's bets on this spin */
    bets: { username: string; space: number; amount: number }[];
    /** After a spin: what each player got back, and their net */
    results: { username: string; won: number; net: number }[];
    limits: { minBet: number; maxBet: number };
    spinsLeft: number;
};

/**
 * A shared wheel: everyone bets on the table for a while, then one spin settles every bet.
 * The round runs for a number of spins, and ends early when a betting window passes with no bet.
 */
export class Roulette extends PartyRound {
    static readonly MAX_SPINS = 10;

    /** How many times the table's maximum bet a player can put down on one spin */
    static readonly MAX_TOTAL = 5;

    static readonly HISTORY = 12;

    /** Instance values, so tests can shorten them */
    public timings = { betMs: 20_000, spinMs: 6000, resultsMs: 4000 };

    /** Overridable for tests: a whole number in [0, max) */
    public random: (max: number) => number = (max) => randomInt(max);

    private phase: RoulettePhase = 'betting';

    private deadline = 0;

    private readonly bets = new Map<Session, Bet[]>();

    private result: number | null = null;

    private spinStartedAt: number | null = null;

    private history: number[] = [];

    private results: SanitizedRoulette['results'] = [];

    private spins = 0;

    constructor(party: Party, onRoundEnd: () => void) {
        super(party, onRoundEnd, 'Roulette');
    }

    public start(): void {
        this.openBetting();
    }

    public act(session: Session, action: string, [space, amount]: number[]): Promise<void> {
        if (action === 'bet') {
            return this.bet(session, space, amount);
        }
        if (action === 'clear') {
            return this.clear(session);
        }
        this.wrongMove();
    }

    public async bet(session: Session, space: number, amount: number): Promise<void> {
        if (session.user.isGuest()) {
            throw new Error('Log in to play Roulette');
        }
        if (this.over || this.phase !== 'betting') {
            throw new Error('No more bets');
        }
        if (!Number.isInteger(space) || !ROULETTE_SPACES[space]) {
            throw new Error('Not a place on the table');
        }
        const { minBet, maxBet } = this.party.options;
        if (!Number.isInteger(amount) || amount < minBet || amount > maxBet) {
            throw new Error(`Bets are ${formatMoney(minBet)} to ${formatMoney(maxBet)}`);
        }
        const mine = this.bets.get(session) ?? [];
        const total = mine.reduce((sum, bet) => sum + bet.amount, 0);
        if (total + amount > maxBet * Roulette.MAX_TOTAL) {
            throw new Error(`At most ${formatMoney(maxBet * Roulette.MAX_TOTAL)} on one spin`);
        }
        if (session.user.money < amount) {
            throw new Error('Not enough money for this bet');
        }
        // Counted before paying, so quick bets can't slip past the total while payments are under way
        const bet = { space, amount };
        mine.push(bet);
        this.bets.set(session, mine);
        try {
            await UserController.buy(session.user, amount, 'Roulette', 'bet');
        } catch (error) {
            mine.splice(mine.indexOf(bet), 1);
            throw error;
        }
        // Betting closed while paying: the bet missed the spin
        if (this.over || this.phase !== 'betting') {
            mine.splice(mine.indexOf(bet), 1);
            await this.refund([{ session, amount }]);
            throw new Error('No more bets');
        }
        this.broadcast();
    }

    /** Takes back every bet of a player, before the wheel spins */
    public async clear(session: Session): Promise<void> {
        if (this.phase !== 'betting') {
            throw new Error('No more bets');
        }
        const mine = this.bets.get(session) ?? [];
        this.bets.delete(session);
        await this.refund(mine.map(({ amount }) => ({ session, amount })));
        this.broadcast();
    }

    private openBetting(): void {
        this.phase = 'betting';
        this.bets.clear();
        this.result = null;
        this.spinStartedAt = null;
        this.results = [];
        this.deadline = Date.now() + this.timings.betMs;
        this.schedule(this.timings.betMs, () => this.spin());
        this.broadcast();
    }

    private spin(): void {
        // Nobody bet: the table is done for now
        if (![...this.bets.values()].some((bets) => bets.length)) {
            this.end();
            return;
        }
        this.phase = 'spinning';
        this.result = this.random(37);
        this.spinStartedAt = Date.now();
        this.spins++;
        this.deadline = this.spinStartedAt + this.timings.spinMs;
        this.schedule(this.timings.spinMs, () => logFailure(this.settle(), 'Roulette'));
        this.broadcast();
    }

    /** The ball has landed: pay the winners, then the next spin or the end of the round */
    private async settle(): Promise<void> {
        await this.pay();
        this.phase = 'results';
        this.history = [this.result!, ...this.history].slice(0, Roulette.HISTORY);
        this.deadline = Date.now() + this.timings.resultsMs;
        this.schedule(this.timings.resultsMs, () => (this.spins >= Roulette.MAX_SPINS ? this.end() : this.openBetting()));
        this.broadcast();
    }

    private async pay(): Promise<void> {
        const result = this.result!;
        const bets = [...this.bets];
        // Settled once: a second call finds nothing left to pay
        this.bets.clear();
        this.results = [];
        await Promise.all(
            bets.map(async ([session, mine]) => {
                const staked = mine.reduce((sum, bet) => sum + bet.amount, 0);
                const won = mine.reduce((sum, bet) => sum + roulettePayout(bet.space, bet.amount, result), 0);
                this.results.push({ username: session.user.username, won, net: won - staked });
                if (won) {
                    await UserController.giveMoney(session.user, won, 'Roulette', 'win');
                }
            }),
        );
        // Kept for the results screen
        bets.forEach(([session, mine]) => this.bets.set(session, mine));
    }

    public async onSessionLeft(): Promise<void> {
        // A bet stays on the table and is paid like any other
    }

    public syncConnections(connections: Connection[]): void {
        const payload = this.sanitized();
        connections.forEach((connection) => connection.send('roulette', payload));
    }

    private sanitized(): SanitizedRoulette {
        const { minBet, maxBet } = this.party.options;
        return {
            channelId: this.party.channel.id,
            phase: this.phase,
            deadline: this.deadline,
            result: this.result,
            spinStartedAt: this.spinStartedAt,
            spinMs: this.timings.spinMs,
            history: this.history,
            bets: [...this.bets].flatMap(([session, mine]) =>
                mine.map(({ space, amount }) => ({ username: session.user.username, space, amount })),
            ),
            results: this.results,
            limits: { minBet, maxBet },
            spinsLeft: Roulette.MAX_SPINS - this.spins,
        };
    }

    /**
     * Called when the round ends or the channel is deleted: bets not yet spun are refunded, a spin under way is paid
     */
    public async destroy(): Promise<void> {
        this.over = true;
        this.cancelStep();
        if (this.phase === 'spinning') {
            await this.pay();
            return;
        }
        if (this.phase === 'betting') {
            const refunds = [...this.bets].flatMap(([session, mine]) => mine.map(({ amount }) => ({ session, amount })));
            this.bets.clear();
            await this.refund(refunds);
        }
    }
}
