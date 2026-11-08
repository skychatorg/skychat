import { randomInt } from 'node:crypto';
import { formatMoney } from '../../../../api/money.js';
import { Connection } from '../../../skychat/Connection.js';
import { Session } from '../../../skychat/Session.js';
import { SanitizedUser } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { logFailure } from '../casino/BlackjackTable.js';
import type { Party } from './Party.js';

/**
 * - joining: players buy a seat around the circle, all at the same stake
 * - playing: the bomb goes from hand to hand until its hidden fuse runs out
 * - done: whoever held it gets nothing, the other players share the pot by how long each held the bomb
 */
export type HotPotatoPhase = 'joining' | 'playing' | 'done';

/**
 * - heldMs: how long this player held the bomb this round, not counting the current hold
 * - paid: the stake and every pass fee, all of it comes back if the game is torn down mid-round
 */
type Seat = { session: Session; payout: number | null; heldMs: number; paid: number };

export type SanitizedHotPotato = {
    channelId: number;
    phase: HotPotatoPhase;
    round: number;
    rounds: number;
    /** Wall-clock ms at which joining closes */
    deadline: number | null;
    /** Wall-clock ms the bomb was lit, it fizzes harder from there. The fuse itself is never sent */
    startedAt: number | null;
    /** The server's clock when this was sent */
    now: number;
    /** In cents, set by the first player to join */
    stake: number | null;
    pot: number;
    minBet: number;
    maxBet: number;
    minPlayers: number;
    players: { user: SanitizedUser; payout: number | null; heldMs: number }[];
    /** Seat index of the one holding the bomb */
    holder: number | null;
    /** Wall-clock ms at which the holder got the bomb, so clients can count the current hold */
    heldSince: number | null;
    /** Wall-clock ms at which the holder may pass */
    canPassAt: number | null;
    /** Seat the holder picked during the hold: the bomb goes there the moment the hold ends */
    aim: number | null;
    /** The last few passes only */
    passes: { from: number; to: number }[];
    passCount: number;
    /** How long the bomb must be held before passing, in ms */
    holdMs: number;
    /** What a pass costs, in cents, into the pot */
    passFee: number;
    /** Seat index of the one it blew up on */
    loser: number | null;
};

/**
 * A bomb with a hidden fuse goes around a circle of players. Hold it at least a moment, then pass it to anyone
 * for a small fee into the pot. When it blows, its holder gets nothing and the others share the pot by how long
 * each held it: holding is a risk that pays, up to a point. Nothing rewards being fast: the fuse is as likely to
 * blow in any second, and a pass picked during the hold goes out the moment it ends.
 */
export class HotPotato {
    static readonly ROUNDS = 3;

    /** Two is a duel: the bomb goes back and forth until it blows */
    static readonly MIN_PLAYERS = 2;

    /** Share of the stake a pass costs, paid by the passer into the pot: the game plays the same at any stake */
    static readonly PASS_FEE_SHARE = 0.1;

    /** Instance values, so tests can shorten them */
    public timings = {
        joinMs: 20_000,
        lastCallMs: 4000,
        holdMs: 1500,
        fuseMinMs: 3000,
        fuseMeanMs: 10_000,
        fuseMaxMs: 60_000,
        resultsMs: 6000,
    };

    /** Overridable for tests: a whole number in [0, max) */
    public random: (max: number) => number = (max) => randomInt(max);

    private phase: HotPotatoPhase = 'joining';

    private round = 0;

    private seats: Seat[] = [];

    private stake: number | null = null;

    private pot = 0;

    private holder: number | null = null;

    private canPassAt: number | null = null;

    private heldSince: number | null = null;

    private aim: number | null = null;

    private passTimer: ReturnType<typeof setTimeout> | undefined;

    private passes: { from: number; to: number }[] = [];

    private loser: number | null = null;

    private deadline: number | null = null;

    private startedAt: number | null = null;

    private timer: ReturnType<typeof setTimeout> | undefined;

    private fuse: ReturnType<typeof setTimeout> | undefined;

    private over = false;

    constructor(
        private readonly party: Party,
        private readonly onRoundEnd: () => void,
    ) {}

    public start(): void {
        this.openJoining();
    }

    public async join(session: Session, amount: number): Promise<void> {
        if (session.user.isGuest()) {
            throw new Error('Log in to play');
        }
        if (this.phase !== 'joining' || this.over) {
            throw new Error('Wait for the next round');
        }
        if (this.seats.some((s) => s.session === session)) {
            throw new Error('You are already in');
        }
        // The first one in sets the stake, everyone after pays the same. Asking for another one is refused,
        // so two players clicking at once never get charged a stake they did not pick
        if (this.stake !== null && amount !== this.stake) {
            throw new Error(`The stake is ${formatMoney(this.stake)}`);
        }
        const stake = this.stake ?? amount;
        const { minBet, maxBet } = this.party.options;
        if (!Number.isInteger(stake) || stake < minBet || stake > maxBet) {
            throw new Error(`Stakes are between ${formatMoney(minBet)} and ${formatMoney(maxBet)}`);
        }
        if (session.user.money < stake) {
            throw new Error(`You need ${formatMoney(stake)} to join`);
        }
        // Seated before paying: a second join in the same instant must not go through
        const seat: Seat = { session, payout: null, heldMs: 0, paid: stake };
        this.seats.push(seat);
        this.stake = stake;
        try {
            await UserController.buy(session.user, stake, 'Hot Potato stake');
        } catch (error) {
            this.seats.splice(this.seats.indexOf(seat), 1);
            if (!this.seats.length) {
                this.stake = null;
            }
            throw error;
        }
        this.pot += stake;
        // Everyone here is in: a last call, not the whole clock
        const players = this.party.channel.sessions.filter((s) => !s.user.isGuest());
        const lastCallAt = Date.now() + this.timings.lastCallMs;
        if (
            this.seats.length >= HotPotato.MIN_PLAYERS &&
            lastCallAt < this.deadline! &&
            players.every((s) => this.seats.some((seat) => seat.session === s))
        ) {
            this.deadline = lastCallAt;
            this.schedule(this.timings.lastCallMs, () => this.light());
        }
        this.broadcast();
    }

    /**
     * Pick who gets the bomb. During the hold the pick is kept and the bomb goes the moment the hold ends,
     * so a human who clicks early passes exactly as fast as a script would
     */
    public async pass(session: Session, to: number): Promise<void> {
        if (this.phase !== 'playing' || this.over) {
            throw new Error('No bomb right now');
        }
        const from = this.seats.findIndex((s) => s.session === session);
        if (from === -1 || from !== this.holder) {
            throw new Error('You are not holding the bomb');
        }
        if (!Number.isInteger(to) || to < 0 || to >= this.seats.length || to === from) {
            throw new Error('Pass it to someone else');
        }
        if (!this.present(to)) {
            throw new Error(`${this.seats[to].session.user.username} left the table`);
        }
        const wait = this.canPassAt! - Date.now();
        if (wait > 0) {
            this.aim = to;
            clearTimeout(this.passTimer);
            this.passTimer = setTimeout(() => logFailure(this.passNow(from)), wait);
            this.broadcast();
            return;
        }
        this.aim = to;
        await this.passNow(from);
    }

    /** The pass itself, to wherever the holder aimed, if that still makes sense */
    private async passNow(from: number): Promise<void> {
        const to = this.aim;
        if (this.phase !== 'playing' || this.over || this.holder !== from || to === null || !this.present(to)) {
            return;
        }
        const seat = this.seats[from];
        this.handOver(to);
        // The fee is best effort: a broke player still gets rid of the bomb.
        // In the pot before the await, so a bomb going off meanwhile shares it too
        const fee = this.passFee();
        if (seat.session.user.money >= fee) {
            this.pot += fee;
            seat.paid += fee;
            this.broadcast();
            try {
                await UserController.buy(seat.session.user, fee, 'Hot Potato pass');
            } catch (error) {
                this.pot -= fee;
                seat.paid -= fee;
                throw error;
            }
        }
    }

    /** In cents, at least one */
    private passFee(): number {
        return Math.max(1, Math.round((this.stake ?? 0) * HotPotato.PASS_FEE_SHARE));
    }

    /** Still at the table: the bomb can't be parked on someone who left */
    private present(index: number): boolean {
        return this.party.channel.sessions.includes(this.seats[index].session);
    }

    public async onSessionLeft(session: Session): Promise<void> {
        const index = this.seats.findIndex((s) => s.session === session);
        if (index === -1) {
            return;
        }
        // Before the round the stake comes back
        if (this.phase === 'joining') {
            const stake = this.stake!;
            this.seats.splice(index, 1);
            this.pot -= stake;
            if (!this.seats.length) {
                this.stake = null;
            }
            await UserController.giveMoney(session.user, stake, 'Hot Potato refund');
            this.broadcast();
            return;
        }
        // Mid-round they stay in the circle, nobody can pass to them, and a bomb they hold stays with them:
        // leaving is no way out
        if (this.aim === index) {
            this.aim = null;
            clearTimeout(this.passTimer);
            this.broadcast();
        }
    }

    public syncConnections(connections: Connection[]): void {
        const payload = this.sanitized();
        connections.forEach((connection) => connection.send('hot-potato', payload));
    }

    /**
     * Called when the round ends or the channel is deleted: a round not settled yet gives back all each paid, fees included
     */
    public async destroy(): Promise<void> {
        this.over = true;
        clearTimeout(this.timer);
        clearTimeout(this.fuse);
        clearTimeout(this.passTimer);
        const seats = this.phase === 'done' ? [] : this.seats;
        this.seats = [];
        await Promise.all(seats.map((s) => UserController.giveMoney(s.session.user, s.paid, 'Hot Potato refund')));
    }

    public sanitized(): SanitizedHotPotato {
        return {
            channelId: this.party.channel.id,
            phase: this.phase,
            round: this.round,
            rounds: HotPotato.ROUNDS,
            deadline: this.deadline,
            startedAt: this.startedAt,
            now: Date.now(),
            stake: this.stake,
            pot: this.pot,
            minBet: this.party.options.minBet,
            maxBet: this.party.options.maxBet,
            minPlayers: HotPotato.MIN_PLAYERS,
            players: this.seats.map(({ session, payout, heldMs }) => ({ user: session.user.sanitized(), payout, heldMs })),
            holder: this.holder,
            heldSince: this.heldSince,
            canPassAt: this.canPassAt,
            aim: this.aim,
            passes: this.passes.slice(-5),
            passCount: this.passes.length,
            holdMs: this.timings.holdMs,
            passFee: this.passFee(),
            loser: this.loser,
        };
    }

    private openJoining(): void {
        this.phase = 'joining';
        this.round++;
        this.seats = [];
        this.stake = null;
        this.pot = 0;
        this.holder = null;
        this.heldSince = null;
        this.canPassAt = null;
        this.aim = null;
        this.passes = [];
        this.loser = null;
        this.startedAt = null;
        this.deadline = Date.now() + this.timings.joinMs;
        this.schedule(this.timings.joinMs, () => this.light());
        this.broadcast();
    }

    private light(): void {
        if (this.phase !== 'joining' || this.over) {
            return;
        }
        // Not enough players: everyone gets the stake back, and the round is over
        if (this.seats.length < HotPotato.MIN_PLAYERS) {
            const seats = this.seats;
            this.seats = [];
            logFailure(Promise.all(seats.map((s) => UserController.giveMoney(s.session.user, s.paid, 'Hot Potato refund'))));
            this.end();
            return;
        }
        this.phase = 'playing';
        this.deadline = null;
        this.startedAt = Date.now();
        this.handOver(this.random(this.seats.length));
        // Same danger in every second past the minimum, so no moment is a safe one to hold it
        const { fuseMinMs, fuseMeanMs, fuseMaxMs } = this.timings;
        const fuseMs = Math.min(fuseMaxMs, fuseMinMs - Math.log(1 - this.random(1_000_000) / 1_000_000) * fuseMeanMs);
        this.fuse = setTimeout(() => logFailure(this.explode()), fuseMs);
    }

    private handOver(to: number): void {
        if (this.holder !== null) {
            this.passes.push({ from: this.holder, to });
            this.clockHold();
        }
        this.holder = to;
        this.aim = null;
        clearTimeout(this.passTimer);
        this.heldSince = Date.now();
        this.canPassAt = Date.now() + this.timings.holdMs;
        this.broadcast();
    }

    /** Adds the current hold to the holder's time */
    private clockHold(): void {
        if (this.holder !== null && this.heldSince !== null) {
            this.seats[this.holder].heldMs += Date.now() - this.heldSince;
        }
    }

    private async explode(): Promise<void> {
        if (this.phase !== 'playing' || this.over) {
            return;
        }
        this.phase = 'done';
        this.clockHold();
        clearTimeout(this.passTimer);
        this.loser = this.holder;
        this.heldSince = null;
        this.canPassAt = null;
        this.aim = null;
        const winners = this.seats.filter((_, i) => i !== this.loser);
        this.seats[this.loser!].payout = 0;
        this.split(winners);
        this.broadcast();
        // Scheduled before paying, so a game torn down meanwhile never starts another round
        this.schedule(this.timings.resultsMs, () => (this.round >= HotPotato.ROUNDS ? this.end() : this.openJoining()));
        await Promise.all(winners.map((seat) => UserController.giveMoney(seat.session.user, seat.payout!, 'Hot Potato win')));
    }

    /**
     * Survivors share the whole pot by how long each held the bomb. No stake comes back for free: passing it on at
     * once is safe but slowly pays the braver players. Nobody held it, an even split. Cent for cent, the house takes nothing
     */
    private split(winners: Seat[]): void {
        const totalMs = winners.reduce((sum, seat) => sum + seat.heldMs, 0);
        const weight = (seat: Seat) => (totalMs ? seat.heldMs / totalMs : 1 / winners.length);
        winners.forEach((seat) => (seat.payout = Math.floor(this.pot * weight(seat))));
        // The cents lost to rounding go to the bravest first
        let leftover = this.pot - winners.reduce((sum, seat) => sum + seat.payout!, 0);
        for (const seat of [...winners].sort((a, b) => b.heldMs - a.heldMs)) {
            if (leftover-- <= 0) {
                break;
            }
            seat.payout!++;
        }
    }

    private end(): void {
        if (this.over) {
            return;
        }
        this.over = true;
        clearTimeout(this.timer);
        clearTimeout(this.fuse);
        logFailure(Promise.resolve().then(this.onRoundEnd));
    }

    private schedule(ms: number, fn: () => void): void {
        clearTimeout(this.timer);
        this.timer = setTimeout(fn, ms);
    }

    private broadcast(): void {
        if (!this.over) {
            this.syncConnections(this.party.channel.sessions.flatMap((session) => session.connections));
        }
    }
}
