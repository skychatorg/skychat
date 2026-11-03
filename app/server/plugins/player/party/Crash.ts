import { randomInt } from 'node:crypto';
import { formatMoney } from '../../../../api/money.js';
import { Connection } from '../../../skychat/Connection.js';
import { Session } from '../../../skychat/Session.js';
import { SanitizedUser } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { logFailure } from '../casino/BlackjackTable.js';
import type { Party } from './Party.js';

/**
 * - betting: bets are open for a few seconds
 * - flying: the multiplier climbs until the crash, cash out before it
 * - crashed: the flight is over, everyone sees how it went
 */
export type CrashPhase = 'betting' | 'flying' | 'crashed';

type Bet = { session: Session; bet: number; auto: number | null; cashedAt: number | null; payout: number | null };

export type SanitizedCrash = {
    channelId: number;
    phase: CrashPhase;
    flight: number;
    flights: number;
    /** Wall-clock ms at which bets close */
    deadline: number | null;
    /** Wall-clock ms of the take-off, the multiplier grows from there */
    startedAt: number | null;
    /** The server's clock when this was sent, so clients draw the flight on the server's time */
    now: number;
    /** Doubling time of the multiplier, in ms */
    doubleMs: number;
    /** In hundredths, only once crashed */
    crashedAt: number | null;
    minBet: number;
    maxBet: number;
    bets: { user: SanitizedUser; bet: number; auto: number | null; cashedAt: number | null; payout: number | null }[];
    /** The last crash points, newest first, in hundredths */
    history: number[];
};

/**
 * Everyone bets, a multiplier climbs from ×1.00, and each player cashes out before it crashes, or loses the bet.
 * Multipliers are kept in hundredths (250 is ×2.50) so money maths stays in whole numbers.
 */
export class Crash {
    static readonly FLIGHTS = 5;

    /** Every cash-out target is worth 99% of the bet */
    static readonly HOUSE_EDGE = 0.01;

    static readonly MAX_MULTIPLIER = 10000;

    /** Instance values, so tests can shorten them */
    public timings = { betMs: 12_000, beatMs: 1000, doubleMs: 8000, crashedMs: 4000 };

    /** Overridable for tests: a whole number in [0, max) */
    public random: (max: number) => number = (max) => randomInt(max);

    private phase: CrashPhase = 'betting';

    private flight = 0;

    private bets: Bet[] = [];

    private deadline: number | null = null;

    private startedAt: number | null = null;

    private crashPoint = 100;

    private crashedAt: number | null = null;

    private history: number[] = [];

    private timers: ReturnType<typeof setTimeout>[] = [];

    private over = false;

    constructor(
        private readonly party: Party,
        private readonly onRoundEnd: () => void,
    ) {}

    public start(): void {
        this.openBets();
    }

    /**
     * A crash point in hundredths, where P(crash ≥ x) = 99% / x for any x above ×1.00
     */
    public drawCrashPoint(): number {
        const scale = 1_000_000;
        const roll = this.random(scale);
        const point = Math.floor((100 * (1 - Crash.HOUSE_EDGE) * scale) / (scale - roll));
        return Math.min(Crash.MAX_MULTIPLIER, Math.max(100, point));
    }

    /** The multiplier in hundredths, some ms after take-off */
    public multiplierAt(elapsedMs: number): number {
        return Math.floor(100 * 2 ** (elapsedMs / this.timings.doubleMs));
    }

    public async bet(session: Session, amount: number, auto: number | null): Promise<void> {
        if (session.user.isGuest()) {
            throw new Error('Log in to play');
        }
        if (this.phase !== 'betting' || this.over) {
            throw new Error('Wait for the next flight');
        }
        const { minBet, maxBet } = this.party.options;
        if (!Number.isInteger(amount) || amount < minBet || amount > maxBet) {
            throw new Error(`Bets are between ${formatMoney(minBet)} and ${formatMoney(maxBet)}`);
        }
        if (auto !== null && (!Number.isInteger(auto) || auto < 101 || auto > Crash.MAX_MULTIPLIER)) {
            throw new Error('Auto cash-out is between ×1.01 and ×100');
        }
        if (this.bets.some((b) => b.session === session)) {
            throw new Error('You already bet on this flight');
        }
        if (session.user.money < amount) {
            throw new Error('Not enough money for this bet');
        }
        // Seated before paying: a second bet in the same instant must not go through
        const seat: Bet = { session, bet: amount, auto, cashedAt: null, payout: null };
        this.bets.push(seat);
        try {
            await UserController.buy(session.user, amount, 'Crash bet');
        } catch (error) {
            this.bets.splice(this.bets.indexOf(seat), 1);
            throw error;
        }
        // Everyone who can bet has: no need to wait out the clock. Guests watch, they can't bet
        const players = this.party.channel.sessions.filter((s) => !s.user.isGuest());
        if (this.phase === 'betting' && players.every((s) => this.bets.some((b) => b.session === s))) {
            this.schedule(this.timings.beatMs, () => this.takeOff());
        }
        this.broadcast();
    }

    public async cashOut(session: Session): Promise<void> {
        const seat = this.bets.find((b) => b.session === session);
        if (!seat || this.phase !== 'flying' || seat.cashedAt !== null) {
            throw new Error(seat?.cashedAt ? 'You already cashed out' : 'Nothing to cash out');
        }
        const multiplier = this.multiplierAt(Date.now() - (this.startedAt as number));
        if (multiplier >= this.crashPoint) {
            throw new Error('Too late, it crashed');
        }
        await this.pay(seat, multiplier);
    }

    public async onSessionLeft(session: Session): Promise<void> {
        // Before take-off the bet comes back. In flight it rides on, with its auto cash-out if it has one
        const seat = this.bets.find((b) => b.session === session);
        if (seat && this.phase === 'betting') {
            this.bets.splice(this.bets.indexOf(seat), 1);
            await UserController.giveMoney(session.user, seat.bet, 'Crash refund');
            this.broadcast();
        }
    }

    public syncConnections(connections: Connection[]): void {
        const payload = this.sanitized();
        connections.forEach((connection) => connection.send('crash', payload));
    }

    /**
     * Called when the round ends or the channel is deleted: bets still riding are refunded
     */
    public async destroy(): Promise<void> {
        this.over = true;
        this.clearTimers();
        if (this.phase !== 'crashed') {
            await Promise.all(
                this.bets.filter((b) => b.cashedAt === null).map((b) => UserController.giveMoney(b.session.user, b.bet, 'Crash refund')),
            );
        }
        this.bets = [];
    }

    public sanitized(): SanitizedCrash {
        return {
            channelId: this.party.channel.id,
            phase: this.phase,
            flight: this.flight,
            flights: Crash.FLIGHTS,
            deadline: this.deadline,
            startedAt: this.startedAt,
            now: Date.now(),
            doubleMs: this.timings.doubleMs,
            crashedAt: this.crashedAt,
            minBet: this.party.options.minBet,
            maxBet: this.party.options.maxBet,
            bets: this.bets.map(({ session, bet, auto, cashedAt, payout }) => ({
                user: session.user.sanitized(),
                bet,
                auto,
                cashedAt,
                payout,
            })),
            history: this.history,
        };
    }

    private openBets(): void {
        this.phase = 'betting';
        this.flight++;
        this.bets = [];
        this.startedAt = null;
        this.crashedAt = null;
        this.deadline = Date.now() + this.timings.betMs;
        // Nobody bet: the round is over
        this.schedule(this.timings.betMs, () => (this.bets.length ? this.takeOff() : this.end()));
        this.broadcast();
    }

    private takeOff(): void {
        if (this.phase !== 'betting') {
            return;
        }
        this.clearTimers();
        this.phase = 'flying';
        this.deadline = null;
        this.crashPoint = this.drawCrashPoint();
        this.startedAt = Date.now();
        const timeTo = (multiplier: number) => Math.ceil(Math.log2(multiplier / 100) * this.timings.doubleMs);
        for (const seat of this.bets) {
            if (seat.auto !== null && seat.auto < this.crashPoint) {
                this.timers.push(setTimeout(() => logFailure(this.pay(seat, seat.auto as number)), timeTo(seat.auto)));
            }
        }
        this.timers.push(setTimeout(() => this.crash(), timeTo(this.crashPoint)));
        this.broadcast();
    }

    private async pay(seat: Bet, multiplier: number): Promise<void> {
        if (seat.cashedAt !== null || this.phase !== 'flying') {
            return;
        }
        // Marked before paying: a click and an auto cash-out in the same instant pay once
        seat.cashedAt = multiplier;
        seat.payout = Math.floor((seat.bet * multiplier) / 100);
        this.broadcast();
        await UserController.giveMoney(seat.session.user, seat.payout, 'Crash win');
    }

    private crash(): void {
        this.clearTimers();
        this.phase = 'crashed';
        this.crashedAt = this.crashPoint;
        this.history = [this.crashPoint, ...this.history].slice(0, 12);
        this.bets.filter((b) => b.cashedAt === null).forEach((b) => (b.payout = 0));
        this.broadcast();
        this.schedule(this.timings.crashedMs, () => (this.flight >= Crash.FLIGHTS ? this.end() : this.openBets()));
    }

    private end(): void {
        if (this.over) {
            return;
        }
        this.over = true;
        this.clearTimers();
        logFailure(Promise.resolve().then(this.onRoundEnd));
    }

    private schedule(ms: number, fn: () => void): void {
        this.clearTimers();
        this.timers.push(setTimeout(fn, ms));
    }

    private clearTimers(): void {
        this.timers.forEach((timer) => clearTimeout(timer));
        this.timers = [];
    }

    private broadcast(): void {
        if (this.over) {
            return;
        }
        this.syncConnections(this.party.channel.sessions.flatMap((session) => session.connections));
    }
}
