import { randomInt } from 'node:crypto';
import { formatMoney } from '../../../../api/money.js';
import { Connection } from '../../../skychat/Connection.js';
import { Session } from '../../../skychat/Session.js';
import { UserController } from '../../../skychat/UserController.js';
import { ConfusePlugin } from '../../games/global/ConfusePlugin.js';
import { SandalePlugin } from '../../games/global/SandalePlugin.js';
import { logFailure } from '../casino/BlackjackTable.js';
import { shuffle } from './shuffle.js';
import type { Party } from './Party.js';

export type BalloonSize = 'xs' | 'md' | 'lg' | 'pinata' | 'hotair' | 'peek' | 'freeze' | 'patience' | 'egg';

export type PrizeKind = 'money' | 'jackpot' | 'pinata' | 'peek' | 'freeze' | 'empty' | 'malus' | 'lose';

/** Chances are in percent and add up to 100. Amounts are in cents, like user money */
export type Prize = { chance: number; kind: PrizeKind; amount: number };

export type Malus = 'wizz' | 'scramble' | 'butterfingers' | 'sandale' | 'grounded' | 'storm' | 'grounded-sandale';

/**
 * Money comes back a bit above the price on average for every size, the maluses are what it costs. The $1 balloons are the most generous, as the way back for broke players
 */
export const BALLOONS: { [size in BalloonSize]: { price: number; prizes: Prize[]; maluses: Malus[] } } = {
    xs: {
        price: 100,
        prizes: [
            { chance: 55, kind: 'money', amount: 140 },
            { chance: 14, kind: 'money', amount: 300 },
            { chance: 10, kind: 'empty', amount: 0 },
            { chance: 20, kind: 'malus', amount: 0 },
            { chance: 1, kind: 'jackpot', amount: 1000 },
        ],
        maluses: ['wizz', 'scramble', 'butterfingers'],
    },
    md: {
        price: 500,
        prizes: [
            { chance: 40, kind: 'money', amount: 650 },
            { chance: 12, kind: 'money', amount: 2000 },
            { chance: 17, kind: 'empty', amount: 0 },
            { chance: 30, kind: 'malus', amount: 0 },
            { chance: 1, kind: 'jackpot', amount: 5000 },
        ],
        maluses: ['sandale', 'grounded', 'scramble'],
    },
    lg: {
        price: 2000,
        prizes: [
            { chance: 30, kind: 'money', amount: 4200 },
            { chance: 7, kind: 'money', amount: 12000 },
            { chance: 22, kind: 'empty', amount: 0 },
            { chance: 30, kind: 'malus', amount: 0 },
            { chance: 10, kind: 'lose', amount: 1000 },
            { chance: 1, kind: 'jackpot', amount: 20000 },
        ],
        maluses: ['storm', 'grounded-sandale'],
    },
    // Each hit costs the price and goes into the pot, whoever bursts it takes the pot
    pinata: { price: 100, prizes: [], maluses: [] },
    // Its prize starts at its price and doubles every HOT_AIR_DOUBLE_MS, until someone pops it or it bursts on its own
    hotair: { price: 500, prizes: [], maluses: [] },
    // Shows the popper what another balloon holds
    peek: { price: 100, prizes: [], maluses: [] },
    // Nobody else can pop for FREEZE_MS
    freeze: { price: 25, prizes: [], maluses: [] },
    // Never in the sky at first: a balloon turns into it once two players have popped. Its prize grows with every pop after that
    patience: { price: 500, prizes: [], maluses: [] },
    // Pays EGG_PRIZE, or hatches into a golden md if nobody pops it in time
    egg: { price: 50, prizes: [], maluses: [] },
};

type PlainSize = 'xs' | 'md' | 'lg';

/** A plain balloon's rare variant: same price, no malus, about 160% back. `chance` is in percent, per balloon */
export const GOLDEN: { [size in PlainSize]: { chance: number; prizes: Prize[] } } = {
    xs: {
        chance: 4,
        prizes: [
            { chance: 60, kind: 'money', amount: 120 },
            { chance: 30, kind: 'money', amount: 200 },
            { chance: 10, kind: 'money', amount: 300 },
        ],
    },
    md: {
        chance: 3,
        prizes: [
            { chance: 60, kind: 'money', amount: 600 },
            { chance: 30, kind: 'money', amount: 1000 },
            { chance: 10, kind: 'money', amount: 1400 },
        ],
    },
    lg: {
        chance: 2,
        prizes: [
            { chance: 60, kind: 'money', amount: 2400 },
            { chance: 30, kind: 'money', amount: 4000 },
            { chance: 10, kind: 'money', amount: 5600 },
        ],
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

/** 7 xs, 4 md, 1 lg, and in most rounds a special balloon in place of an xs */
const SKY: BalloonSize[] = ['xs', 'xs', 'xs', 'xs', 'xs', 'xs', 'xs', 'md', 'md', 'md', 'md', 'lg'];

const SPECIALS: BalloonSize[] = ['peek', 'pinata', 'hotair', 'freeze', 'patience', 'egg'];
/** The others are races between players: a player alone only gets these */
const SOLO_SPECIALS: BalloonSize[] = ['peek', 'egg'];

/**
 * - `prize`: drawn on the first peek or pop, so a peek shows what the pop will give
 * - `hits`, `pot`, `paid`: the piñata's, `paid` is what each hitter put in, refunded if it never bursts
 */
type Balloon = {
    id: number;
    size: BalloonSize;
    golden: boolean;
    popped: boolean;
    result: BalloonResult | null;
    prize: Prize | null;
    peekedBy: Set<Session>;
    hits: number;
    pot: number;
    paid: Map<Session, number>;
};

export type BalloonResult = { username: string; kind: PrizeKind; amount: number; malus: Malus | null; label: string; order: number };

export type SanitizedLuckyPop = {
    channelId: number;
    /** Wall-clock ms at which the round ends */
    deadline: number;
    balloons: {
        id: number;
        size: BalloonSize;
        golden: boolean;
        popped: boolean;
        result: BalloonResult | null;
        hits: number;
        pot: number;
        /** What's inside, only for a viewer who peeked at it */
        peek: Prize | null;
        /** The patience balloon's prize right now */
        worth: number | null;
    }[];
    /** What each size costs and holds, shown on hover. Maluses are only named once someone gets one */
    sizes: { [size in BalloonSize]: { price: number; prizes: Prize[] } };
    /** What the golden variant of each plain size holds */
    golden: { [size in PlainSize]: Prize[] };
    /** One hit in this many bursts the piñata */
    pinataOdds: number;
    /** The hot air balloon's prize is its price × 2^((now − startedAt) / doubleMs) */
    hotAir: { startedAt: number; doubleMs: number };
    /** Who froze the sky, until when. Null when it isn't frozen */
    frozen: { username: string; until: number } | null;
    /** Until when prizes pay double. Null when it isn't happy hour */
    happyHour: number | null;
    /** When the egg hatches */
    hatchAt: number;
    /** The viewer's own limits */
    you: { nextPopAt: number; grounded: boolean };
};

/**
 * A shared sky of balloons: pay to pop one, get money, nothing, or a malus.
 * A round ends when the sky is empty or the timer runs out.
 */
export class LuckyPop {
    /** In percent: the share of rounds with a special balloon */
    static readonly SPECIAL_CHANCE = 90;

    /** In percent: the share of skies with a special that get a second, different one */
    static readonly SECOND_SPECIAL_CHANCE = 40;

    static readonly FREEZE_MS = 10_000;

    /** What the patience balloon's prize gains with each balloon popped after it appears */
    static readonly PATIENCE_STEP = 250;

    static readonly HOT_AIR_DOUBLE_MS = 20_000;

    /** What an egg pays when popped before it hatches */
    static readonly EGG_PRIZE = 75;

    /** In percent: the share of rounds with a happy hour, when prizes pay double */
    static readonly HAPPY_HOUR_CHANCE = 40;

    /** How many balloons a peek shows */
    static readonly PEEKS = 3;

    /** Balloons that pay nothing: alone in the sky, they don't keep a round going */
    static readonly BLANKS: BalloonSize[] = ['freeze', 'peek'];

    static readonly STORM_WIZZES = 10;

    /** Every hit has the same chance, so nobody can count hits to know when it bursts */
    static readonly PINATA_ODDS = 12;

    static readonly SIZES = Object.fromEntries(
        Object.entries(BALLOONS).map(([size, { price, prizes }]) => [size, { price, prizes }]),
    ) as SanitizedLuckyPop['sizes'];

    static readonly GOLDEN_PRIZES = Object.fromEntries(
        Object.entries(GOLDEN).map(([size, { prizes }]) => [size, prizes]),
    ) as SanitizedLuckyPop['golden'];

    /** Instance values, so tests can shorten them */
    public timings = {
        roundMs: 90_000,
        cooldownMs: 2000,
        butterfingersMs: 30_000,
        lastPopBeatMs: 2000,
        hotAirDoubleMs: LuckyPop.HOT_AIR_DOUBLE_MS,
        /** Nobody popped or hit for this long: the round is over */
        idleMs: 20_000,
        eggMs: 30_000,
        /** Happy hour starts at a random time in this window, and lasts happyHourMs */
        happyHourFromMs: 8_000,
        happyHourToMs: 25_000,
        happyHourMs: 10_000,
    };

    /** Overridable for tests: a whole number in [0, max) */
    public random: (max: number) => number = (max) => randomInt(max);

    private balloons: Balloon[] = [];

    private deadline = 0;

    private startedAt = 0;

    private timer: ReturnType<typeof setTimeout> | undefined;

    private idleTimer: ReturnType<typeof setTimeout> | undefined;

    /** When the hot air balloon bursts on its own */
    private burstAt = Infinity;

    private burstTimer: ReturnType<typeof setTimeout> | undefined;

    private frozen: { session: Session; until: number } | null = null;

    private happyHourUntil = 0;

    /** Hatching the egg, and starting happy hour */
    private eventTimers: ReturnType<typeof setTimeout>[] = [];

    /** The patience balloon: none, waiting for two players to pop, or out since this many balloons were popped */
    private patience: 'none' | 'waiting' | number = 'none';

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
        this.startedAt = Date.now();
        this.deadline = this.startedAt + this.timings.roundMs;
        this.timer = setTimeout(() => this.end(), this.timings.roundMs);
        const hotAir = this.balloons.find((b) => b.size === 'hotair');
        if (hotAir) {
            // P(still up at ×m) = 1 / m: whenever it is popped, the prize is worth its price on average
            const scale = 1_000_000;
            const multiplier = scale / (scale - this.random(scale));
            this.burstAt = this.startedAt + Math.log2(multiplier) * this.timings.hotAirDoubleMs;
            this.burstTimer = setTimeout(() => this.burstOnItsOwn(hotAir), this.burstAt - this.startedAt);
        }
        const egg = this.balloons.find((b) => b.size === 'egg');
        if (egg) {
            this.eventTimers.push(setTimeout(() => this.hatch(egg), this.timings.eggMs));
        }
        if (this.random(100) < LuckyPop.HAPPY_HOUR_CHANCE) {
            const { happyHourFromMs: from, happyHourToMs: to } = this.timings;
            this.eventTimers.push(setTimeout(() => this.startHappyHour(), from + this.random(to - from + 1)));
        }
        // Drawn last, so tests can script the sky and its events without them
        for (const balloon of this.balloons) {
            const golden = GOLDEN[balloon.size as PlainSize];
            balloon.golden = Boolean(golden) && this.random(100) < golden.chance;
        }
    }

    /** Nobody popped the egg in time: it becomes a golden md */
    private hatch(egg: Balloon): void {
        if (!egg.popped && !this.over) {
            egg.size = 'md';
            egg.golden = true;
            this.broadcast();
        }
    }

    private startHappyHour(): void {
        if (this.over) {
            return;
        }
        this.happyHourUntil = Date.now() + this.timings.happyHourMs;
        this.broadcast();
        // Everyone sees it end on time
        this.eventTimers.push(setTimeout(() => this.broadcast(), this.timings.happyHourMs));
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
            throw new Error(balloon.size === 'pinata' ? 'Someone burst it first' : 'Someone popped it first');
        }
        if (this.grounded.has(session)) {
            throw new Error('You are grounded until the next round');
        }
        const frozen = this.frozen && this.frozen.session !== session ? this.frozen.until - Date.now() : 0;
        if (frozen > 0) {
            throw new Error(`${this.frozen!.session.user.username} froze the sky, wait ${Math.ceil(frozen / 1000)} s`);
        }
        const wait = (this.nextPopAt.get(session) ?? 0) - Date.now();
        if (wait > 0) {
            throw new Error(`Wait ${Math.ceil(wait / 1000)} s before your next pop`);
        }
        const { price } = BALLOONS[balloon.size];
        if (session.user.money < price) {
            throw new Error(`This balloon costs ${formatMoney(price)}`);
        }
        if (balloon.size === 'pinata') {
            return this.hit(session, balloon);
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

        balloon.result = await this.open(session, balloon);
        this.afterPop();
    }

    public onSessionLeft(): void {
        // Cooldowns and groundings stay: leaving and coming back must not reset them
    }

    public syncConnections(connections: Connection[]): void {
        connections.forEach((connection) => connection.send('lucky-pop', this.sanitizedFor(connection.session)));
    }

    /**
     * Called when the round ends or the channel is deleted: a piñata nobody burst gives everyone their hits back
     */
    public async destroy(): Promise<void> {
        this.over = true;
        clearTimeout(this.timer);
        clearTimeout(this.idleTimer);
        clearTimeout(this.burstTimer);
        this.eventTimers.forEach((timer) => clearTimeout(timer));
        const refunds = this.balloons.filter((b) => !b.popped).flatMap((b) => [...b.paid]);
        this.balloons.forEach((b) => b.paid.clear());
        await Promise.all(refunds.map(([session, amount]) => UserController.giveMoney(session.user, amount, 'Lucky Pop refund')));
    }

    public sanitizedFor(session: Session): SanitizedLuckyPop {
        return {
            channelId: this.party.channel.id,
            deadline: this.deadline,
            balloons: this.balloons.map(({ id, size, golden, popped, result, hits, pot, prize, peekedBy }) => ({
                id,
                size,
                golden,
                popped,
                result,
                hits,
                pot,
                // Only on balloons that still hold their prize: never on one that turned into the patience balloon
                peek: peekedBy.has(session) && BALLOONS[size].prizes.length ? prize : null,
                worth: size === 'patience' && !popped ? this.patienceWorth() : null,
            })),
            sizes: LuckyPop.SIZES,
            golden: LuckyPop.GOLDEN_PRIZES,
            pinataOdds: LuckyPop.PINATA_ODDS,
            hotAir: { startedAt: this.startedAt, doubleMs: this.timings.hotAirDoubleMs },
            happyHour: this.happyHourUntil > Date.now() ? this.happyHourUntil : null,
            hatchAt: this.startedAt + this.timings.eggMs,
            frozen:
                this.frozen && this.frozen.until > Date.now()
                    ? { username: this.frozen.session.user.username, until: this.frozen.until }
                    : null,
            you: { nextPopAt: this.nextPopAt.get(session) ?? 0, grounded: this.grounded.has(session) },
        };
    }

    private drawSky(): Balloon[] {
        const sizes: BalloonSize[] = [...SKY];
        if (this.random(100) < LuckyPop.SPECIAL_CHANCE) {
            const players = this.party.players().length;
            const specials = SPECIALS.filter((special) => players > 1 || SOLO_SPECIALS.includes(special));
            const add = () => {
                // Taken out of the list, so a second special is always a different one
                const [special] = specials.splice(this.random(specials.length), 1);
                if (special === 'patience') {
                    this.patience = 'waiting';
                } else {
                    sizes[sizes.indexOf('xs')] = special;
                }
            };
            add();
            if (this.random(100) < LuckyPop.SECOND_SPECIAL_CHANCE) {
                add();
            }
        }
        // Shuffled, so the big one is not always in the same spot
        return shuffle(sizes, this.random).map((size, id) => ({
            id,
            size,
            golden: false,
            popped: false,
            result: null,
            prize: null,
            peekedBy: new Set(),
            hits: 0,
            pot: 0,
            paid: new Map(),
        }));
    }

    /**
     * Pay a hit into the pot. One hit in PINATA_ODDS bursts it, and the hitter takes the whole pot
     */
    private async hit(session: Session, pinata: Balloon): Promise<void> {
        const { price } = BALLOONS.pinata;
        this.nextPopAt.set(session, Date.now() + this.timings.cooldownMs);
        try {
            await UserController.buy(session.user, price, 'Lucky Pop piñata');
        } catch (error) {
            this.nextPopAt.delete(session);
            throw error;
        }
        // Burst while this hit was being paid: the hit never landed
        if (pinata.popped || this.over) {
            await UserController.giveMoney(session.user, price, 'Lucky Pop refund');
            throw new Error('Someone burst it first');
        }
        pinata.hits++;
        pinata.pot += price;
        pinata.paid.set(session, (pinata.paid.get(session) ?? 0) + price);
        if (this.random(LuckyPop.PINATA_ODDS) === 0) {
            pinata.popped = true;
            pinata.paid.clear();
            const order = ++this.pops;
            const { amount, label } = await this.pay(session, pinata.pot, 'Lucky Pop piñata');
            pinata.result = {
                username: session.user.username,
                kind: 'pinata',
                amount,
                malus: null,
                label: `burst the piñata, ${label}`,
                order,
            };
        }
        this.afterPop();
    }

    /** Nobody popped it in time: it flies off with its prize */
    private burstOnItsOwn(hotAir: Balloon): void {
        if (hotAir.popped || this.over) {
            return;
        }
        hotAir.popped = true;
        hotAir.result = { username: '', kind: 'empty', amount: 0, malus: null, label: 'burst on its own', order: ++this.pops };
        this.afterPop();
    }

    /** Its price, plus a step for each balloon popped since it appeared */
    private patienceWorth(): number {
        // Not counting itself, popped just before it pays
        const popped = this.balloons.filter((b) => b.popped && b.size !== 'patience').length;
        return BALLOONS.patience.price + LuckyPop.PATIENCE_STEP * (popped - (this.patience as number));
    }

    /** Once two players have popped, a random balloon left turns into the patience balloon */
    private maybeRevealPatience(): void {
        const poppers = new Set(this.balloons.map((b) => b.result?.username).filter(Boolean));
        const regular = this.balloons.filter((b) => !b.popped && !b.golden && ['xs', 'md', 'lg'].includes(b.size));
        // A balloon nobody peeked at, so no one holds a peek of what it used to be
        const unpeeked = regular.filter((b) => !b.peekedBy.size);
        const left = unpeeked.length ? unpeeked : regular;
        if (this.patience !== 'waiting' || poppers.size < 2 || !left.length) {
            return;
        }
        left[this.random(left.length)].size = 'patience';
        this.patience = this.balloons.filter((b) => b.popped).length;
    }

    /** Show the change, and end the round soon once the sky is empty */
    /**
     * Ends the round soon when nothing worth playing is left:
     * - only balloons that pay nothing are left
     * - every player is grounded
     * - nobody popped or hit for a while once everyone could, unless a hot air balloon or egg is still up: waiting is their game
     */
    private afterPop(): void {
        this.maybeRevealPatience();
        this.broadcast();
        const players = this.party.players();
        const blanksOnly = this.balloons.every((b) => b.popped || LuckyPop.BLANKS.includes(b.size));
        if (blanksOnly || (players.length && players.every((s) => this.grounded.has(s)))) {
            this.endSoon();
            return;
        }
        this.armIdle();
    }

    /** Counted from when every player can pop again: a butterfingers malus must not run out the round */
    private armIdle(): void {
        clearTimeout(this.idleTimer);
        const now = Date.now();
        const freeAt = Math.max(now, ...this.party.players().map((s) => this.nextPopAt.get(s) ?? 0));
        this.idleTimer = setTimeout(
            () => {
                const waiting = this.balloons.some((b) => ['hotair', 'egg'].includes(b.size) && !b.popped);
                return waiting ? this.armIdle() : this.endSoon();
            },
            freeAt - now + this.timings.idleMs,
        );
    }

    private endSoon(): void {
        clearTimeout(this.timer);
        clearTimeout(this.idleTimer);
        // A beat, so the last result shows before the vote
        this.timer = setTimeout(() => this.end(), this.timings.lastPopBeatMs);
    }

    private draw({ size, golden }: Balloon): Prize {
        let roll = this.random(100);
        const prizes = golden ? GOLDEN[size as PlainSize].prizes : BALLOONS[size].prizes;
        return prizes.find((prize) => (roll -= prize.chance) < 0) ?? prizes[prizes.length - 1];
    }

    /**
     * What was inside, applied to whoever popped it
     */
    private async open(session: Session, balloon: Balloon): Promise<BalloonResult> {
        const { size } = balloon;
        const base = { username: session.user.username, amount: 0, malus: null, order: ++this.pops };
        if (size === 'hotair') {
            const now = Date.now();
            if (now >= this.burstAt) {
                return { ...base, kind: 'empty', label: 'burst in their hands' };
            }
            clearTimeout(this.burstTimer);
            const prize = Math.floor(BALLOONS.hotair.price * 2 ** ((now - this.startedAt) / this.timings.hotAirDoubleMs));
            return { ...base, kind: 'money', ...(await this.pay(session, prize)) };
        }
        if (size === 'freeze') {
            this.frozen = { session, until: Date.now() + LuckyPop.FREEZE_MS };
            // Everyone sees the sky thaw on time
            setTimeout(() => this.broadcast(), LuckyPop.FREEZE_MS);
            return { ...base, kind: 'freeze', label: `froze the sky for ${LuckyPop.FREEZE_MS / 1000} s` };
        }
        if (size === 'patience') {
            return { ...base, kind: 'money', ...(await this.pay(session, this.patienceWorth())) };
        }
        if (size === 'peek') {
            // Another balloon that holds a prize, ones you have not peeked at first
            const targets = this.balloons.filter((b) => !b.popped && BALLOONS[b.size].prizes.length);
            const fresh = targets.filter((b) => !b.peekedBy.has(session));
            const pool = fresh.length ? fresh : targets;
            if (!pool.length) {
                return { ...base, kind: 'peek', label: 'nothing left to peek at' };
            }
            const seen: string[] = [];
            while (pool.length && seen.length < LuckyPop.PEEKS) {
                const [target] = pool.splice(this.random(pool.length), 1);
                target.prize ??= this.draw(target);
                target.peekedBy.add(session);
                seen.push((target.golden ? 'a golden ' : 'an ') + target.size);
            }
            const list = seen.length > 1 ? `${seen.slice(0, -1).join(', ')} and ${seen.at(-1)}` : seen[0];
            return { ...base, kind: 'peek', label: `peeked inside ${list} balloon${seen.length > 1 ? 's' : ''}` };
        }
        if (size === 'egg') {
            return { ...base, kind: 'money', ...(await this.pay(session, LuckyPop.EGG_PRIZE)) };
        }
        const prize = (balloon.prize ??= this.draw(balloon));
        const result = { ...base, kind: prize.kind, label: '' };
        switch (prize.kind) {
            case 'money':
            case 'jackpot':
            case 'pinata':
            case 'peek':
            case 'freeze': {
                const { amount, label } = await this.pay(session, prize.amount);
                return { ...result, amount, label: (prize.kind === 'jackpot' ? 'JACKPOT ' : '') + label };
            }
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

    /** Every prize pays double during happy hour */
    private async pay(session: Session, prize: number, reason = 'Lucky Pop win'): Promise<{ amount: number; label: string }> {
        const happy = this.happyHourUntil > Date.now();
        const amount = happy ? prize * 2 : prize;
        await UserController.giveMoney(session.user, amount, reason);
        return { amount, label: '+' + formatMoney(amount) + (happy ? ' (×2)' : '') };
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
