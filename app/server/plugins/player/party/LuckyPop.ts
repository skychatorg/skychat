import { randomInt } from 'node:crypto';
import { formatMoney } from '../../../../api/money.js';
import { Connection } from '../../../skychat/Connection.js';
import { Session } from '../../../skychat/Session.js';
import { UserController } from '../../../skychat/UserController.js';
import { ConfusePlugin } from '../../games/global/ConfusePlugin.js';
import { SandalePlugin } from '../../games/global/SandalePlugin.js';
import { logFailure } from '../casino/BlackjackTable.js';
import type { Party } from './Party.js';

export type BalloonSize = 'xs' | 'md' | 'lg' | 'golden';

export type PrizeKind = 'money' | 'empty' | 'malus' | 'lose';

/** Chances are in percent and add up to 100. Amounts are in cents, like user money */
export type Prize = { chance: number; kind: PrizeKind; amount: number };

export type Malus = 'wizz' | 'scramble' | 'butterfingers' | 'sandale' | 'grounded' | 'storm' | 'grounded-sandale';

/**
 * Money comes back above the price on average for every size, the maluses are what it costs
 */
export const BALLOONS: { [size in BalloonSize]: { price: number; prizes: Prize[]; maluses: Malus[] } } = {
    xs: {
        price: 100,
        prizes: [
            { chance: 50, kind: 'money', amount: 150 },
            { chance: 15, kind: 'money', amount: 300 },
            { chance: 15, kind: 'empty', amount: 0 },
            { chance: 20, kind: 'malus', amount: 0 },
        ],
        maluses: ['wizz', 'scramble', 'butterfingers'],
    },
    md: {
        price: 500,
        prizes: [
            { chance: 40, kind: 'money', amount: 800 },
            { chance: 12, kind: 'money', amount: 2000 },
            { chance: 18, kind: 'empty', amount: 0 },
            { chance: 30, kind: 'malus', amount: 0 },
        ],
        maluses: ['sandale', 'grounded', 'scramble'],
    },
    lg: {
        price: 2000,
        prizes: [
            { chance: 30, kind: 'money', amount: 4000 },
            { chance: 8, kind: 'money', amount: 12000 },
            { chance: 22, kind: 'empty', amount: 0 },
            { chance: 30, kind: 'malus', amount: 0 },
            { chance: 10, kind: 'lose', amount: 1000 },
        ],
        maluses: ['storm', 'grounded-sandale'],
    },
    golden: {
        price: 500,
        prizes: [
            { chance: 60, kind: 'money', amount: 600 },
            { chance: 30, kind: 'money', amount: 1000 },
            { chance: 10, kind: 'money', amount: 1400 },
        ],
        maluses: [],
    },
};

export const MALUS_LABELS: { [malus in Malus]: string } = {
    wizz: 'wizzed',
    scramble: 'next message scrambled',
    butterfingers: 'butterfingers: no pops for 30 s',
    sandale: 'next message turns into 👞',
    grounded: 'grounded until the next round',
    storm: 'wizz storm: 10 wizzes over a minute',
    'grounded-sandale': 'grounded, and next message turns into 👞',
};

/** 7 xs, 4 md, 1 lg */
const SKY: BalloonSize[] = ['xs', 'xs', 'xs', 'xs', 'xs', 'xs', 'xs', 'md', 'md', 'md', 'md', 'lg'];

type Balloon = { id: number; size: BalloonSize; popped: boolean; result: BalloonResult | null };

export type BalloonResult = { username: string; kind: PrizeKind; amount: number; malus: Malus | null; label: string; order: number };

export type SanitizedLuckyPop = {
    channelId: number;
    /** Wall-clock ms at which the round ends */
    deadline: number;
    balloons: { id: number; size: BalloonSize; popped: boolean; result: BalloonResult | null }[];
    /** What each size costs and holds, shown on hover. Maluses are only named once someone gets one */
    sizes: { [size in BalloonSize]: { price: number; prizes: Prize[] } };
    /** The viewer's own limits */
    you: { nextPopAt: number; grounded: boolean };
};

/**
 * A shared sky of balloons: pay to pop one, get money, nothing, or a malus.
 * A round ends when the sky is empty or the timer runs out.
 */
export class LuckyPop {
    static readonly GOLDEN_CHANCE = 10;

    static readonly STORM_WIZZES = 10;

    static readonly SIZES = Object.fromEntries(
        Object.entries(BALLOONS).map(([size, { price, prizes }]) => [size, { price, prizes }]),
    ) as SanitizedLuckyPop['sizes'];

    /** Instance values, so tests can shorten them */
    public timings = { roundMs: 90_000, cooldownMs: 5000, butterfingersMs: 30_000, lastPopBeatMs: 2000 };

    /** Overridable for tests: a whole number in [0, max) */
    public random: (max: number) => number = (max) => randomInt(max);

    private balloons: Balloon[] = [];

    private deadline = 0;

    private timer: ReturnType<typeof setTimeout> | undefined;

    private readonly nextPopAt = new Map<Session, number>();

    private readonly grounded = new Set<Session>();

    private pops = 0;

    private over = false;

    constructor(
        private readonly party: Party,
        private readonly onRoundEnd: () => void,
    ) {}

    public start(): void {
        this.balloons = this.drawSky();
        this.deadline = Date.now() + this.timings.roundMs;
        this.timer = setTimeout(() => this.end(), this.timings.roundMs);
    }

    public async pop(session: Session, id: number): Promise<void> {
        if (session.user.isGuest()) {
            throw new Error('Log in to pop balloons');
        }
        const balloon = this.balloons.find((b) => b.id === id);
        if (this.over || !balloon) {
            throw new Error('This balloon is gone');
        }
        if (balloon.popped) {
            throw new Error('Someone popped it first');
        }
        if (this.grounded.has(session)) {
            throw new Error('You are grounded until the next round');
        }
        const wait = (this.nextPopAt.get(session) ?? 0) - Date.now();
        if (wait > 0) {
            throw new Error(`Wait ${Math.ceil(wait / 1000)} s before your next pop`);
        }
        const { price } = BALLOONS[balloon.size];
        if (session.user.money < price) {
            throw new Error(`This balloon costs ${formatMoney(price)}`);
        }

        // Taken before paying: two pops on the same balloon in the same instant must not both win
        balloon.popped = true;
        this.nextPopAt.set(session, Date.now() + this.timings.cooldownMs);
        try {
            await UserController.buy(session.user, price, 'Lucky Pop');
        } catch (error) {
            balloon.popped = false;
            this.nextPopAt.delete(session);
            throw error;
        }

        balloon.result = await this.open(session, balloon.size);
        this.broadcast();
        if (this.balloons.every((b) => b.popped)) {
            clearTimeout(this.timer);
            // A beat, so the last result shows before the vote
            this.timer = setTimeout(() => this.end(), this.timings.lastPopBeatMs);
        }
    }

    public onSessionLeft(): void {
        // Cooldowns and groundings stay: leaving and coming back must not reset them
    }

    public syncConnections(connections: Connection[]): void {
        connections.forEach((connection) => connection.send('lucky-pop', this.sanitizedFor(connection.session)));
    }

    public async destroy(): Promise<void> {
        this.over = true;
        clearTimeout(this.timer);
    }

    public sanitizedFor(session: Session): SanitizedLuckyPop {
        return {
            channelId: this.party.channel.id,
            deadline: this.deadline,
            balloons: this.balloons.map(({ id, size, popped, result }) => ({ id, size, popped, result })),
            sizes: LuckyPop.SIZES,
            you: { nextPopAt: this.nextPopAt.get(session) ?? 0, grounded: this.grounded.has(session) },
        };
    }

    private drawSky(): Balloon[] {
        const sizes: BalloonSize[] = [...SKY];
        if (this.random(100) < LuckyPop.GOLDEN_CHANCE) {
            sizes[sizes.indexOf('md')] = 'golden';
        }
        // Shuffled, so the big one is not always in the same spot
        for (let i = sizes.length - 1; i > 0; i--) {
            const j = this.random(i + 1);
            [sizes[i], sizes[j]] = [sizes[j], sizes[i]];
        }
        return sizes.map((size, id) => ({ id, size, popped: false, result: null }));
    }

    private draw(size: BalloonSize): Prize {
        let roll = this.random(100);
        const { prizes } = BALLOONS[size];
        return prizes.find((prize) => (roll -= prize.chance) < 0) ?? prizes[prizes.length - 1];
    }

    /**
     * What was inside, applied to whoever popped it
     */
    private async open(session: Session, size: BalloonSize): Promise<BalloonResult> {
        const prize = this.draw(size);
        const result = { username: session.user.username, kind: prize.kind, amount: 0, malus: null, label: '', order: ++this.pops };
        switch (prize.kind) {
            case 'money':
                await UserController.giveMoney(session.user, prize.amount, 'Lucky Pop win');
                return { ...result, amount: prize.amount, label: '+' + formatMoney(prize.amount) };
            case 'empty':
                return { ...result, label: 'empty' };
            case 'lose': {
                // Never more than what is left
                const loss = Math.min(prize.amount, session.user.money);
                if (loss) {
                    await UserController.buy(session.user, loss, 'Lucky Pop');
                }
                return {
                    ...result,
                    amount: loss ? -loss : 0,
                    label: loss ? `popped in their face, −${formatMoney(loss)}` : 'popped in their face, wallet already empty',
                };
            }
            case 'malus': {
                const maluses = BALLOONS[size].maluses;
                const malus = maluses[this.random(maluses.length)];
                this.applyMalus(session, malus);
                return { ...result, malus, label: MALUS_LABELS[malus] };
            }
        }
    }

    private applyMalus(session: Session, malus: Malus): void {
        const plugins = this.party.channel.manager.plugin.manager;
        // One-shot flags on the next message, owned by these plugins
        const flag = (plugin: string) => (plugins.getPlugin(plugin) as ConfusePlugin | SandalePlugin | null)?.flag(session.identifier);
        switch (malus) {
            case 'wizz':
                session.send('wizz', { from: session.user.sanitized() });
                return;
            case 'scramble':
                return flag('confuse');
            case 'sandale':
                return flag('sandale');
            case 'butterfingers':
                this.nextPopAt.set(session, Date.now() + this.timings.butterfingersMs);
                return;
            case 'grounded':
                this.grounded.add(session);
                return;
            case 'grounded-sandale':
                this.grounded.add(session);
                return flag('sandale');
            case 'storm':
                return this.party.wizzStorm(session, LuckyPop.STORM_WIZZES);
        }
    }

    private end(): void {
        if (this.over) {
            return;
        }
        this.over = true;
        logFailure(Promise.resolve().then(this.onRoundEnd));
    }

    private broadcast(): void {
        if (this.over) {
            return;
        }
        this.party.channel.sessions.forEach((session) =>
            session.connections.forEach((connection) => connection.send('lucky-pop', this.sanitizedFor(session))),
        );
    }
}
