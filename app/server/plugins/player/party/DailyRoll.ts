import { randomInt } from 'node:crypto';
import { Connection } from '../../../skychat/Connection.js';
import { Session } from '../../../skychat/Session.js';
import { logFailure } from '../../../skychat/Logging.js';
import { UserController } from '../../../skychat/UserController.js';
import { shuffle } from './shuffle.js';
import type { Party } from './Party.js';

/** Geneva's time zone: Europe/Zurich is the IANA zone it uses */
const TIME_ZONE = 'Europe/Zurich';

/** How far Geneva's clock is ahead of UTC at `at`, in ms */
function zoneOffset(at: number): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
    }).formatToParts(at);
    const get = (type: string) => Number(parts.find((part) => part.type === type)!.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(at / 1000) * 1000;
}

/**
 * - picking: everyone picks a card, until the deadline
 * - countdown: 3, 2, 1 until the deadline
 * - revealing: the free cards flip fast, then each picked card after a beat of suspense
 * - done: the board stays up a moment before the vote
 */
export type DailyRollPhase = 'picking' | 'countdown' | 'revealing' | 'done';

export type SanitizedDailyRoll = {
    channelId: number;
    phase: DailyRollPhase;
    /** Wall-clock ms at which picking or the countdown ends, 0 otherwise */
    deadline: number;
    /** The picked card about to flip */
    suspense: number | null;
    /** `amount` stays null until that card flips, so the jackpot cannot be read off the wire */
    cards: { id: number; username: string | null; amount: number | null }[];
    jackpot: number;
    /** Cards worth this much or more get a big win show */
    bigWin: number;
};

/**
 * Once a day per party channel: everyone picks one free card from a board, then the board is revealed and paid
 */
export class DailyRoll {
    static readonly CARDS = 30;

    /** In cents: the big cards, the first one the jackpot. Every other card holds $0 to $5 */
    static readonly PRIZES = [8000, 4000, 4000, 1000, 1000, 1000, 1000];

    static readonly JACKPOT = DailyRoll.PRIZES[0];

    static readonly BIG_WIN = DailyRoll.PRIZES[1];

    /** The lock lifts at this hour, server time */
    static readonly RESET_HOUR = 22;

    /** Instance values, so tests can shorten them */
    public timings = {
        pickMs: 60_000,
        lastCallMs: 10_000,
        countdownMs: 3000,
        flipMs: 120,
        suspenseMs: 1800,
        afterFlipMs: 700,
        resultsMs: 10_000,
    };

    /** Overridable for tests: a whole number in [0, max) */
    public random: (max: number) => number = (max) => randomInt(max);

    private phase: DailyRollPhase = 'picking';

    private deadline = 0;

    private suspense: number | null = null;

    private timer: ReturnType<typeof setTimeout> | undefined;

    private readonly picks = new Map<number, Session>();

    private amounts: number[] = [];

    private readonly shown = new Set<number>();

    private over = false;

    constructor(
        private readonly party: Party,
        private readonly onRoundEnd: () => void,
    ) {}

    /**
     * The first 10 PM after `now` on Geneva's clock, in ms, whatever time zone the server runs in
     */
    static nextReset(now: number): number {
        // Geneva's date now, then 10 PM that day on Geneva's clock, or the next day's once past
        const local = new Date(now + zoneOffset(now));
        for (let day = 0; ; day++) {
            const wall = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + day, DailyRoll.RESET_HOUR);
            // The offset at the reset itself: it differs from now's on daylight saving days
            const reset = wall - zoneOffset(wall - zoneOffset(now));
            if (reset > now) {
                return reset;
            }
        }
    }

    public start(): void {
        this.deadline = Date.now() + this.timings.pickMs;
        this.timer = setTimeout(() => logFailure(this.reveal(), 'Daily Roll'), this.timings.pickMs);
    }

    public act(session: Session, action: string, [id]: number[]): void {
        if (action !== 'card') {
            throw new Error('That is not a Daily Roll move');
        }
        this.pick(session, id);
    }

    public pick(session: Session, id: number): void {
        if (session.user.isGuest()) {
            throw new Error('Log in to pick a card');
        }
        if (this.phase !== 'picking' || this.over) {
            throw new Error('Picks are closed');
        }
        if (!Number.isInteger(id) || id < 0 || id >= DailyRoll.CARDS) {
            throw new Error('This card does not exist');
        }
        const previous = [...this.picks].find(([, picker]) => picker === session)?.[0];
        if (previous === id) {
            return;
        }
        if (this.picks.has(id)) {
            throw new Error('Someone took this card');
        }
        // Picking again moves your pick, until picks close
        if (previous !== undefined) {
            this.picks.delete(previous);
        }
        this.picks.set(id, session);
        // Everyone here picked: only a last call left to change your mind
        const pickers = [...this.picks.values()];
        const lastCallAt = Date.now() + this.timings.lastCallMs;
        if (lastCallAt < this.deadline && this.party.channel.sessions.every((s) => s.user.isGuest() || pickers.includes(s))) {
            clearTimeout(this.timer);
            this.deadline = lastCallAt;
            this.timer = setTimeout(() => logFailure(this.reveal(), 'Daily Roll'), this.timings.lastCallMs);
        }
        this.broadcast();
    }

    public onSessionLeft(): void {
        // A picked card stays picked, and is paid when it flips
    }

    public syncConnections(connections: Connection[]): void {
        connections.forEach((connection) => connection.send('daily-roll', this.sanitized()));
    }

    public async destroy(): Promise<void> {
        this.over = true;
        clearTimeout(this.timer);
    }

    public sanitized(): SanitizedDailyRoll {
        return {
            channelId: this.party.channel.id,
            phase: this.phase,
            deadline: this.deadline,
            suspense: this.suspense,
            cards: Array.from({ length: DailyRoll.CARDS }, (_, id) => ({
                id,
                username: this.picks.get(id)?.user.username ?? null,
                amount: this.shown.has(id) ? this.amounts[id] : null,
            })),
            jackpot: DailyRoll.JACKPOT,
            bigWin: DailyRoll.BIG_WIN,
        };
    }

    /**
     * The whole show, from the countdown to the vote. Stops wherever it is when the game is destroyed
     */
    private async reveal(): Promise<void> {
        if (this.phase !== 'picking') {
            return;
        }
        this.phase = 'countdown';
        this.deadline = Date.now() + this.timings.countdownMs;
        this.broadcast();
        if (!(await this.wait(this.timings.countdownMs))) {
            return;
        }

        // Drawn only now, so nothing about the board exists before the picks are in
        const cardIds = () => Array.from({ length: DailyRoll.CARDS }, (_, id) => id);
        this.amounts = Array.from({ length: DailyRoll.CARDS }, () => this.random(6) * 100);
        const spots = shuffle(cardIds(), this.random);
        DailyRoll.PRIZES.forEach((amount, i) => (this.amounts[spots[i]] = amount));
        this.phase = 'revealing';
        this.deadline = 0;

        const ids = shuffle(cardIds(), this.random);
        // The picked cards flip smallest first, so the big ones come last
        const picked = ids.filter((id) => this.picks.has(id)).sort((a, b) => this.amounts[a] - this.amounts[b]);
        for (const id of ids.filter((id) => !this.picks.has(id))) {
            this.shown.add(id);
            this.broadcast();
            if (!(await this.wait(this.timings.flipMs))) {
                return;
            }
        }
        for (const id of picked) {
            this.suspense = id;
            this.broadcast();
            if (!(await this.wait(this.timings.suspenseMs))) {
                return;
            }
            this.suspense = null;
            this.shown.add(id);
            if (this.amounts[id]) {
                await UserController.giveMoney(this.picks.get(id)!.user, this.amounts[id], 'Daily roll', 'win');
            }
            this.broadcast();
            if (!(await this.wait(this.timings.afterFlipMs))) {
                return;
            }
        }

        this.phase = 'done';
        this.broadcast();
        if (await this.wait(this.timings.resultsMs)) {
            this.over = true;
            this.onRoundEnd();
        }
    }

    /**
     * False when the game was destroyed meanwhile
     */
    private async wait(ms: number): Promise<boolean> {
        await new Promise((resolve) => (this.timer = setTimeout(resolve, ms)));
        return !this.over;
    }

    private broadcast(): void {
        if (!this.over) {
            this.syncConnections(this.party.connections());
        }
    }
}
