import { formatMoney } from '../../../../api/money.js';
import { Connection } from '../../../skychat/Connection.js';
import { Logging } from '../../../skychat/Logging.js';
import { Session } from '../../../skychat/Session.js';
import { SanitizedUser } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import type { PlayerChannel } from '../PlayerChannel.js';
import { Card, createShoe, dealerShouldHit, handValue, isBlackjack, isBust, Outcome, settle } from './blackjack.js';

export type CasinoOptions = { game: 'blackjack'; minBet: number; maxBet: number };

/**
 * - results: the hand is settled and bets are closed for a moment, so everyone sees how it ended
 * - waiting: no hand running, the last results stay on the table and the next bet opens a new hand
 */
export type TablePhase = 'betting' | 'playing' | 'dealer' | 'results' | 'waiting';

type Seat = {
    session: Session;
    bet: number;
    doubled: boolean;
    cards: Card[];
    done: boolean;
    outcome: Outcome | null;
    payout: number | null;
};

export type SanitizedSeat = {
    user: SanitizedUser;
    bet: number;
    doubled: boolean;
    cards: Card[];
    total: number;
    done: boolean;
    outcome: Outcome | null;
    payout: number | null;
};

export type SanitizedBlackjackTable = {
    channelId: number;
    phase: TablePhase;
    handId: number;
    /** Wall-clock ms at which the current phase times out, so clients count down without drift */
    deadline: number | null;
    minBet: number;
    maxBet: number;
    maxSeats: number;
    /** A hidden hole card is null */
    dealer: { cards: (Card | null)[]; total: number | null };
    seats: SanitizedSeat[];
};

/**
 * Money moves hit the DB and can fail: log it, since an unhandled rejection stops the server
 */
export const logFailure = (work: Promise<unknown>): void => {
    work.catch((error) => Logging.error('Blackjack table', error));
};

/**
 * One shared blackjack table: everyone plays their own hand against the dealer, at the same time.
 * Phases are driven by timers here, never inside a command, so a running hand never holds a player's command queue.
 */
export class BlackjackTable {
    static readonly MAX_SEATS = 5;

    /** Hands in a party round, before the channel votes for the next game */
    static readonly ROUND_HANDS = 5;

    /** Amounts are in cents, like user money */
    static readonly DEFAULT_OPTIONS: CasinoOptions = { game: 'blackjack', minBet: 1000, maxBet: 10000 };

    /** Instance values, so tests can shorten them */
    public timings = { betMs: 15_000, dealBeatMs: 700, turnMs: 20_000, dealerStepMs: 1300, resultsMs: 8000, idleMs: 30_000 };

    /** Overridable for tests: the shoe for the next hand, drawn with pop() */
    public shuffle: () => Card[] = () => createShoe();

    public readonly options: CasinoOptions;

    private phase: TablePhase = 'waiting';

    private handId = 0;

    private deadline: number | null = null;

    private seats: Seat[] = [];

    private dealer: Card[] = [];

    /** The dealer flips the hole card one beat into its turn, so the players' last cards land first */
    private holeRevealed = false;

    private shoe: Card[] = [];

    private timer: ReturnType<typeof setTimeout> | null = null;

    private handsPlayed = 0;

    constructor(
        private readonly channel: PlayerChannel,
        options: Partial<CasinoOptions> = {},
        private readonly onRoundEnd?: () => void,
    ) {
        this.options = { ...BlackjackTable.DEFAULT_OPTIONS, ...options };
    }

    /**
     * Opens the table for a party round
     */
    public start(): void {
        this.idle();
    }

    public get seatedCount(): number {
        return this.phase === 'waiting' ? 0 : this.seats.length;
    }

    public async bet(session: Session, amount: number): Promise<void> {
        if (session.user.isGuest()) {
            throw new Error('Log in to play at the casino');
        }
        if (this.phase === 'results') {
            throw new Error('The next hand opens in a moment');
        }
        if (this.phase !== 'waiting' && this.phase !== 'betting') {
            throw new Error('Wait for the next hand');
        }
        if (!Number.isInteger(amount) || amount < this.options.minBet || amount > this.options.maxBet) {
            throw new Error(`Bets are between ${formatMoney(this.options.minBet)} and ${formatMoney(this.options.maxBet)}`);
        }
        if (this.phase === 'betting' && this.seatOf(session)) {
            throw new Error('You already placed a bet');
        }
        if (this.phase === 'betting' && this.seats.length >= BlackjackTable.MAX_SEATS) {
            throw new Error('The table is full');
        }
        if (session.user.money < amount) {
            throw new Error('Not enough money for this bet');
        }

        if (this.phase === 'waiting') {
            this.seats = [];
            this.dealer = [];
            this.holeRevealed = false;
            this.phase = 'betting';
            this.handId++;
            this.schedule(this.timings.betMs, () => this.deal());
        }
        this.seats.push({ session, bet: amount, doubled: false, cards: [], done: false, outcome: null, payout: null });
        await UserController.buy(session.user, amount, 'Blackjack bet');

        // No need to wait out the clock once everyone watching has bet, just a beat so the last chip lands before the cards
        if (this.channel.sessions.every((s) => this.seatOf(s))) {
            this.schedule(this.timings.dealBeatMs, () => this.deal());
        }
        this.broadcast();
    }

    public hit(session: Session): void {
        const seat = this.activeSeat(session);
        seat.cards.push(this.draw());
        if (handValue(seat.cards).total >= 21) {
            seat.done = true;
        }
        this.afterAction();
    }

    public stand(session: Session): void {
        this.activeSeat(session).done = true;
        this.afterAction();
    }

    public async double(session: Session): Promise<void> {
        const seat = this.activeSeat(session);
        if (seat.cards.length !== 2) {
            throw new Error('You can only double on your first two cards');
        }
        if (session.user.money < seat.bet) {
            throw new Error('Not enough money to double');
        }
        const extra = seat.bet;
        seat.bet += extra;
        seat.doubled = true;
        seat.cards.push(this.draw());
        seat.done = true;
        await UserController.buy(session.user, extra, 'Blackjack double');
        this.afterAction();
    }

    /**
     * A player who leaves gets the bet back before the deal, and stands if the hand already started
     */
    public async onSessionLeft(session: Session): Promise<void> {
        const seat = this.seatOf(session);
        if (!seat) {
            return;
        }
        if (this.phase === 'betting') {
            this.seats.splice(this.seats.indexOf(seat), 1);
            await this.refund(seat);
            if (!this.seats.length) {
                this.reset();
                this.idle();
            }
            this.broadcast();
            return;
        }
        if (this.phase === 'playing' && !seat.done) {
            seat.done = true;
            this.afterAction();
        }
    }

    /**
     * Called when the channel is deleted: unfinished hands are refunded
     */
    public async destroy(): Promise<void> {
        this.clearTimer();
        // Settled hands were already paid
        if (this.phase !== 'results' && this.phase !== 'waiting') {
            await Promise.all(this.seats.map((seat) => this.refund(seat)));
        }
        this.reset();
    }

    public sanitized(): SanitizedBlackjackTable {
        const holeHidden = !this.holeRevealed;
        const visibleDealer = holeHidden ? this.dealer.slice(0, 1) : this.dealer;
        return {
            channelId: this.channel.id,
            phase: this.phase,
            handId: this.handId,
            deadline: this.deadline,
            minBet: this.options.minBet,
            maxBet: this.options.maxBet,
            maxSeats: BlackjackTable.MAX_SEATS,
            dealer: {
                cards: holeHidden && this.dealer.length > 1 ? [this.dealer[0], null] : [...this.dealer],
                total: visibleDealer.length ? handValue(visibleDealer).total : null,
            },
            seats: this.seats.map((seat) => ({
                user: seat.session.user.sanitized(),
                bet: seat.bet,
                doubled: seat.doubled,
                cards: [...seat.cards],
                total: handValue(seat.cards).total,
                done: seat.done,
                outcome: seat.outcome,
                payout: seat.payout,
            })),
        };
    }

    public syncConnections(connections: Connection[]): void {
        const payload = this.sanitized();
        connections.forEach((connection) => connection.send('casino-table', payload));
    }

    private broadcast(): void {
        const payload = this.sanitized();
        this.channel.sessions.forEach((session) => session.send('casino-table', payload));
        // The channel list shows how many are seated
        this.channel.manager.sync();
    }

    private deal(): void {
        if (this.phase !== 'betting') {
            return;
        }
        this.shoe = this.shuffle();
        for (let round = 0; round < 2; round++) {
            this.seats.forEach((seat) => seat.cards.push(this.draw()));
            this.dealer.push(this.draw());
        }
        this.seats.forEach((seat) => (seat.done = isBlackjack(seat.cards)));
        this.phase = 'playing';
        this.schedule(this.timings.turnMs, () => {
            this.seats.forEach((seat) => (seat.done = true));
            this.afterAction();
        });
        this.afterAction();
    }

    private afterAction(): void {
        if (this.phase === 'playing' && this.seats.every((seat) => seat.done)) {
            this.playDealer();
            return;
        }
        this.broadcast();
    }

    private playDealer(): void {
        this.phase = 'dealer';
        this.clearTimer();
        this.broadcast();
        // The dealer only draws if someone can still beat it
        const contested = this.seats.some((seat) => !isBust(seat.cards) && !isBlackjack(seat.cards));
        const step = () => {
            if (contested && dealerShouldHit(this.dealer)) {
                this.dealer.push(this.draw());
                this.broadcast();
                this.schedule(this.timings.dealerStepMs, step, false);
            } else {
                return this.settleAll();
            }
        };
        const reveal = () => {
            this.holeRevealed = true;
            this.broadcast();
            this.schedule(this.timings.dealerStepMs, step, false);
        };
        this.schedule(this.timings.dealerStepMs, reveal, false);
    }

    private async settleAll(): Promise<void> {
        this.clearTimer();
        for (const seat of this.seats) {
            const { outcome, payout } = settle(seat.cards, this.dealer, seat.bet);
            seat.outcome = outcome;
            seat.payout = payout;
        }
        this.phase = 'results';
        this.schedule(this.timings.resultsMs, () => {
            this.phase = 'waiting';
            this.handsPlayed++;
            this.clearTimer();
            this.broadcast();
            this.idle();
        });
        await Promise.all(
            this.seats
                .filter((seat) => seat.payout)
                .map((seat) => UserController.giveMoney(seat.session.user, seat.payout as number, 'Blackjack payout')),
        );
        this.broadcast();
    }

    private draw(): Card {
        // Never fail a hand on an empty shoe, start a fresh deck instead
        if (!this.shoe.length) {
            this.shoe = createShoe();
        }
        return this.shoe.pop() as Card;
    }

    private seatOf(session: Session): Seat | undefined {
        return this.seats.find((seat) => seat.session === session);
    }

    private activeSeat(session: Session): Seat {
        const seat = this.phase === 'playing' ? this.seatOf(session) : undefined;
        if (!seat || seat.done) {
            throw new Error('It is not your turn to play');
        }
        return seat;
    }

    private schedule(ms: number, fn: () => void | Promise<void>, withDeadline = true): void {
        this.clearTimer();
        this.deadline = withDeadline ? Date.now() + ms : null;
        this.timer = setTimeout(() => logFailure(Promise.resolve().then(fn)), ms);
    }

    /**
     * In a party, the round ends after a few hands, or when nobody bets for a while. Only ever from waiting, so no bet is in play
     */
    private idle(): void {
        if (!this.onRoundEnd) {
            return;
        }
        if (this.handsPlayed >= BlackjackTable.ROUND_HANDS) {
            return this.onRoundEnd();
        }
        // No deadline: the table shows no countdown while nobody plays
        this.schedule(this.timings.idleMs, this.onRoundEnd, false);
    }

    private clearTimer(): void {
        this.deadline = null;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private reset(): void {
        this.clearTimer();
        this.phase = 'waiting';
        this.seats = [];
        this.dealer = [];
    }

    private async refund(seat: Seat): Promise<void> {
        await UserController.giveMoney(seat.session.user, seat.bet, 'Blackjack refund');
    }
}
