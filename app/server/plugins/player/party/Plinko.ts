import { randomInt, randomUUID } from 'node:crypto';
import { formatMoney } from '../../../../api/money.js';
import { PLINKO, PLINKO_SLOTS, PLINKO_SMALL_WINS, plinkoFlightMs, plinkoPath } from '../../../../api/plinko.js';
import { Connection } from '../../../skychat/Connection.js';
import { logFailure } from '../../../skychat/Logging.js';
import { Session } from '../../../skychat/Session.js';
import { UserController } from '../../../skychat/UserController.js';
import type { Party } from './Party.js';
import { PartyRound } from './PartyRound.js';

type Ball = {
    id: string;
    session: Session;
    slot: number;
    path: boolean[];
    droppedAt: number;
    /** What it pays on landing: a small win, or the reserved jackpot */
    win: number;
    jackpot: boolean;
    timer: ReturnType<typeof setTimeout>;
};

export type PlinkoLanding = { id: string; username: string; win: number; jackpot: boolean };

export type SanitizedPlinko = {
    channelId: number;
    /** The jackpot as everyone sees it: a jackpot still falling counts until it lands */
    jackpot: number;
    /** Balls in the air: clients animate them from `droppedAt`, so everyone sees the same fall */
    balls: { id: string; username: string; slot: number; path: boolean[]; droppedAt: number }[];
    /** The last balls landed, newest first */
    recent: PlinkoLanding[];
    /** When the round ends if nobody drops again. Null while balls are falling */
    idleDeadline: number | null;
    /** The viewer's own cooldown */
    you: { nextDropAt: number };
};

/**
 * A shared board: pay to drop a ball, win a multiple of it, or the jackpot every party channel feeds.
 * The server draws each result first, then a path that lands on it, and pays when the ball lands, so nobody's
 * balance or jackpot meter gives a result away early. The round ends once nobody has dropped for a while.
 */
export class Plinko extends PartyRound {
    static readonly RECENT = 12;

    /** Instance values, so tests can shorten them */
    public timings = {
        /** Nobody dropped since the last landing for this long: the round is over */
        idleMs: 30_000,
        /** After this long no new ball is taken, so the channel gets back to its vote */
        roundMs: 5 * 60_000,
        cooldownMs: 1000,
    };

    /** Overridable for tests: a whole number in [0, max) */
    public random: (max: number) => number = (max) => randomInt(max);

    /** Overridable for tests: how long a ball falls */
    public flightMs: (path: boolean[]) => number = plinkoFlightMs;

    private readonly balls = new Map<string, Ball>();

    private recent: PlinkoLanding[] = [];

    private readonly nextDropAt = new Map<Session, number>();

    private closed = false;

    private idleDeadline: number | null = null;

    private idleTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(party: Party, onRoundEnd: () => void) {
        super(party, onRoundEnd, 'Plinko');
    }

    private get plugin() {
        return this.party.channel.manager.plugin;
    }

    public start(): void {
        this.waitForDrops();
        this.schedule(this.timings.roundMs, () => {
            this.closed = true;
            this.endWhenSettled();
        });
    }

    public act(session: Session, action: string): Promise<void> {
        if (action !== 'drop') {
            this.wrongMove();
        }
        return this.drop(session);
    }

    public async drop(session: Session): Promise<void> {
        if (session.user.isGuest()) {
            throw new Error('Log in to play Plinko');
        }
        if (this.over || this.closed) {
            throw new Error('This round is over');
        }
        const wait = (this.nextDropAt.get(session) ?? 0) - Date.now();
        if (wait > 0) {
            throw new Error('One ball at a time');
        }
        if (session.user.money < PLINKO.ballPrice) {
            throw new Error(`A ball costs ${formatMoney(PLINKO.ballPrice)}`);
        }
        this.nextDropAt.set(session, Date.now() + this.timings.cooldownMs);
        try {
            await UserController.buy(session.user, PLINKO.ballPrice, 'Plinko', 'bet');
        } catch (error) {
            this.nextDropAt.delete(session);
            throw error;
        }
        // Paid: from here on the ball falls whatever happens
        this.plugin.addToPlinkoJackpot(PLINKO.toJackpot);
        const id = randomUUID();
        const slot = this.drawSlot();
        const jackpot = PLINKO_SLOTS[slot] === 'jackpot';
        const win = jackpot
            ? this.plugin.reservePlinkoJackpot(id, session.user.id, session.user.username)
            : PLINKO.ballPrice * (PLINKO_SLOTS[slot] as number);
        if (win && !jackpot) {
            this.plugin.holdPlinkoWin(id, session.user.id, session.user.username, win);
        }
        const path = plinkoPath(slot, this.random);
        const droppedAt = Date.now();
        const ball: Ball = {
            id,
            session,
            slot,
            path,
            droppedAt,
            win,
            jackpot,
            timer: setTimeout(() => this.land(ball), this.flightMs(path)),
        };
        this.balls.set(id, ball);
        // A ball in the air keeps the round going until it lands
        clearTimeout(this.idleTimer);
        this.idleDeadline = null;
        this.broadcast();
    }

    /** The result first: the jackpot, else a small win from its table, else nothing. Then one of its slots */
    private drawSlot(): number {
        let wanted: (typeof PLINKO_SLOTS)[number] = 0;
        if (this.random(PLINKO.jackpotOdds) === 0) {
            wanted = 'jackpot';
        } else {
            let roll = this.random(10_000);
            for (const { multiplier, chance } of PLINKO_SMALL_WINS) {
                if (roll < chance) {
                    wanted = multiplier as (typeof PLINKO_SLOTS)[number];
                    break;
                }
                roll -= chance;
            }
        }
        const slots = PLINKO_SLOTS.flatMap((value, slot) => (value === wanted ? [slot] : []));
        return slots[this.random(slots.length)];
    }

    private land(ball: Ball): void {
        this.balls.delete(ball.id);
        // Once paid, the meters drop a won jackpot
        logFailure(
            this.pay(ball).then(() => ball.jackpot && this.broadcast()),
            'Plinko',
        );
        this.recent = [{ id: ball.id, username: ball.session.user.username, win: ball.win, jackpot: ball.jackpot }, ...this.recent].slice(
            0,
            Plinko.RECENT,
        );
        if (this.closed) {
            this.endWhenSettled();
        } else if (!this.balls.size) {
            this.waitForDrops();
        }
        this.broadcast();
    }

    private async pay(ball: Ball): Promise<void> {
        // Paid once only, whoever gets there first: this landing, or the payout of leftovers at startup
        if (!ball.win || !this.plugin.hasPlinkoWin(ball.id)) {
            return;
        }
        await UserController.giveMoney(ball.session.user, ball.win, ball.jackpot ? 'Plinko jackpot' : 'Plinko', 'win');
        this.plugin.releasePlinkoWin(ball.id);
        if (!ball.jackpot) {
            return;
        }
        await this.announce(`★ ${ball.session.user.username} hit the Plinko jackpot: ${formatMoney(ball.win)}! ★`);
    }

    /** A jackpot is news for the whole chat, not only this channel */
    private async announce(content: string): Promise<void> {
        const mainRoom = this.plugin.manager.rooms.find((room) => room.main);
        await mainRoom?.sendMessage({ content, user: UserController.getNeutralUser() });
    }

    private waitForDrops(): void {
        clearTimeout(this.idleTimer);
        this.idleDeadline = Date.now() + this.timings.idleMs;
        this.idleTimer = setTimeout(() => this.end(), this.timings.idleMs);
    }

    private endWhenSettled(): void {
        if (!this.balls.size) {
            this.end();
        }
    }

    /** A ball already dropped keeps falling and pays its owner, even gone */
    public async onSessionLeft(): Promise<void> {}

    public syncConnections(connections: Connection[]): void {
        connections.forEach((connection) => connection.send('plinko', this.sanitizedFor(connection.session)));
    }

    private sanitizedFor(session: Session): SanitizedPlinko {
        return {
            channelId: this.party.channel.id,
            jackpot: this.plugin.plinkoJackpotShown,
            balls: [...this.balls.values()].map(({ id, session: owner, slot, path, droppedAt }) => ({
                id,
                username: owner.user.username,
                slot,
                path,
                droppedAt,
            })),
            recent: this.recent,
            idleDeadline: this.idleDeadline,
            you: { nextDropAt: this.nextDropAt.get(session) ?? 0 },
        };
    }

    /**
     * Called when the round ends or the channel is deleted: balls still falling are paid now, never lost
     */
    public async destroy(): Promise<void> {
        this.over = true;
        this.cancelStep();
        clearTimeout(this.idleTimer);
        const falling = [...this.balls.values()];
        this.balls.clear();
        for (const ball of falling) {
            clearTimeout(ball.timer);
        }
        await Promise.all(falling.map((ball) => this.pay(ball)));
    }
}
