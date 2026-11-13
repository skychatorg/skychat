import { randomInt } from 'node:crypto';
import { Connection } from '../../../skychat/Connection.js';
import { Session } from '../../../skychat/Session.js';
import { SanitizedUser } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { logFailure } from '../casino/BlackjackTable.js';
import { shuffle } from './shuffle.js';
import type { Party } from './Party.js';

/**
 * - betting: four new monkeys, everyone backs one
 * - fighting: the fight plays out, KO'd monkeys stay on the floor
 * - done: the last one standing pays those who backed it
 */
export type MonkeyFightPhase = 'betting' | 'fighting' | 'done';

export type Trait = 'berserk' | 'coward' | 'banana' | 'showoff' | 'grudge' | 'vampire' | 'thrower' | 'ninja' | 'zombie' | 'gorilla';

/** Indices into the client's palettes, so the server never deals with colours */
export type Skin = { fur: number; face: number; accessory: number; eyes: number };

export type Stats = { hp: number; attack: number; defense: number; speed: number };

export type Monkey = { id: number; name: string; skin: Skin; stats: Stats; trait: Trait };

/**
 * One action of the fight:
 * - on the actor itself: a trip hurts it, a heal is the banana stash, a revive is the zombie getting up, a roar stuns everyone else, stunned is a lost turn
 * - a counter is the ninja hitting back right after dodging
 * - `gain` is what a vampire drank from the blow
 */
export type FightEvent = {
    actor: number;
    target: number;
    kind: 'hit' | 'crit' | 'miss' | 'heal' | 'trip' | 'counter' | 'revive' | 'roar' | 'stunned';
    amount: number;
    ko: boolean;
    gain?: number;
};

/** An event of the fight as it plays: when it starts and how long it lasts, in ms from the first punch */
export type TimedFightEvent = FightEvent & { at: number; duration: number };

type Bet = { session: Session; monkey: number; bet: number; payout: number | null };

export type SanitizedMonkeyFight = {
    channelId: number;
    phase: MonkeyFightPhase;
    fight: number;
    fights: number;
    /** Wall-clock ms at which bets close */
    deadline: number | null;
    /** Wall-clock ms of the first punch */
    startedAt: number | null;
    minBet: number;
    maxBet: number;
    /** `trait` stays null while betting: it is the surprise of the fight. `odds` are in hundredths */
    monkeys: (Omit<Monkey, 'trait'> & { trait: Trait | null; odds: number })[];
    /** Null while betting, so the fight cannot be read ahead */
    events: TimedFightEvent[] | null;
    bets: { user: SanitizedUser; monkey: number; bet: number; payout: number | null }[];
};

const FIRST_NAMES = ['Igor', 'Boris', 'Dmitri', 'Vlad', 'Sergei', 'Yuri', 'Oleg', 'Viktor', 'Ivan', 'Grigori', 'Anatoly', 'Nikolai'];
const LAST_NAMES = [
    'Bananov',
    'Gorillov',
    'Kongovich',
    'Makakov',
    'Bonobski',
    'Mandrillov',
    'Babuinov',
    'Chimpenko',
    'Orangutanov',
    'Krushchimp',
    'Primatov',
    'Kalashnikong',
    'Silverbackov',
    'Gibbonovich',
];
const TRAITS: Trait[] = ['berserk', 'coward', 'banana', 'showoff', 'grudge', 'vampire', 'thrower', 'ninja', 'zombie', 'gorilla'];
/** Damage factors, the price some traits pay for their power */
const TRAIT_DAMAGE: Partial<Record<Trait, number>> = { coward: 0.75, thrower: 1.1, gorilla: 1.15, zombie: 0.85 };
/** Chance in percent to dodge a blow, 10 for everyone else */
const DODGE: Partial<Record<Trait, number>> = { coward: 30, ninja: 17 };
/** A berserk at its last breath hits this many times harder */
const BERSERK_MAX = 1.5;
/** A grudge hits harder whoever hit it last */
const GRUDGE_REVENGE = 1.45;
const SKINS = { fur: 8, face: 4, accessory: 7, eyes: 3 };

/** A fight that drags on is called on points, so a fight always ends */
const MAX_EVENTS = 80;

/**
 * Plays a whole fight. Pure: the same monkeys and the same rolls give the same fight
 */
export function simulate(monkeys: Monkey[], random: (max: number) => number): { events: FightEvent[]; winner: number } {
    const hp = monkeys.map((m) => m.stats.hp);
    // Faster monkeys act more often
    const nextAt = monkeys.map((m) => 1000 / m.stats.speed + random(100));
    const lastHitBy = monkeys.map(() => -1);
    const ateBanana = monkeys.map(() => false);
    const revived = monkeys.map(() => false);
    const stunned = monkeys.map(() => false);
    const alive = () => monkeys.map((m) => m.id).filter((id) => hp[id] > 0);
    const events: FightEvent[] = [];

    const strike = (actor: number, target: number, crit: boolean, factor = 1) => {
        const { trait, stats } = monkeys[actor];
        // ×1.4 so a fight is about 25 big actions
        let damage = (stats.attack * 1.4 * (80 + random(41)) * factor) / 100;
        damage *= TRAIT_DAMAGE[trait] ?? 1;
        if (trait === 'berserk') {
            damage *= BERSERK_MAX - (BERSERK_MAX - 1) * (hp[actor] / stats.hp);
        }
        if (trait === 'grudge' && target === lastHitBy[actor]) {
            damage *= GRUDGE_REVENGE;
        }
        if (crit) {
            damage *= trait === 'showoff' ? 2.5 : 2;
        }
        // A coconut from afar doesn't care about defense
        const defense = trait === 'thrower' ? 0 : monkeys[target].stats.defense / 2;
        return Math.min(hp[target], Math.max(1, Math.round(damage - defense)));
    };
    const land = (actor: number, target: number, kind: FightEvent['kind'], amount: number) => {
        hp[target] -= amount;
        lastHitBy[target] = actor;
        const event: FightEvent = { actor, target, kind, amount, ko: hp[target] === 0 };
        if (monkeys[actor].trait === 'vampire') {
            const gain = Math.min(monkeys[actor].stats.hp - hp[actor], Math.round(amount * 0.15));
            if (gain > 0) {
                hp[actor] += gain;
                event.gain = gain;
            }
        }
        events.push(event);
        if (event.ko && monkeys[target].trait === 'zombie' && !revived[target]) {
            revived[target] = true;
            hp[target] = Math.round(monkeys[target].stats.hp * 0.08);
            events.push({ actor: target, target, kind: 'revive', amount: hp[target], ko: false });
        }
    };

    while (alive().length > 1 && events.length < MAX_EVENTS) {
        const actor = alive().reduce((a, b) => (nextAt[b] < nextAt[a] ? b : a));
        const me = monkeys[actor];
        nextAt[actor] += 1000 / me.stats.speed + random(100);

        if (stunned[actor]) {
            stunned[actor] = false;
            events.push({ actor, target: actor, kind: 'stunned', amount: 0, ko: false });
            continue;
        }
        if (me.trait === 'banana' && !ateBanana[actor] && hp[actor] < me.stats.hp * 0.35) {
            ateBanana[actor] = true;
            const amount = Math.min(me.stats.hp - hp[actor], Math.round(me.stats.hp * 0.3));
            hp[actor] += amount;
            events.push({ actor, target: actor, kind: 'heal', amount, ko: false });
            continue;
        }
        const others = alive().filter((id) => id !== actor);
        if (me.trait === 'gorilla' && others.some((id) => !stunned[id]) && random(100) < 30) {
            others.forEach((id) => (stunned[id] = true));
            events.push({ actor, target: actor, kind: 'roar', amount: 0, ko: false });
            continue;
        }
        const target = me.trait === 'grudge' && others.includes(lastHitBy[actor]) ? lastHitBy[actor] : others[random(others.length)];
        const roll = random(100);
        if (me.trait === 'showoff' && roll < 5) {
            // Never a KO on itself: tripping is embarrassing, not fatal
            const amount = Math.min(hp[actor] - 1, Math.round(me.stats.hp * 0.06));
            hp[actor] -= amount;
            events.push({ actor, target: actor, kind: 'trip', amount, ko: false });
            continue;
        }
        if (roll >= 100 - (DODGE[monkeys[target].trait] ?? 10)) {
            events.push({ actor, target, kind: 'miss', amount: 0, ko: false });
            if (monkeys[target].trait === 'ninja' && random(100) < 30) {
                land(target, actor, 'counter', strike(target, actor, false, 0.7));
            }
            continue;
        }
        const crit = random(100) < (me.trait === 'showoff' ? 33 : 10);
        land(actor, target, crit ? 'crit' : 'hit', strike(actor, target, crit));
    }

    const standing = alive();
    const share = (id: number) => hp[id] / monkeys[id].stats.hp;
    return { events, winner: standing.reduce((a, b) => (share(b) > share(a) ? b : a)) };
}

/**
 * Four random monkeys fight, last one standing wins. Everyone backs one monkey, at odds the server
 * works out by running the fight thousands of times, so every bet is worth 99% of its stake on average.
 */
export class MonkeyFight {
    static readonly FIGHTS = 1;

    static readonly MONKEYS = 4;

    /** The house keeps 1% of every bet on average, like Crash */
    static readonly HOUSE_EDGE = 0.01;

    /** In hundredths: a monkey that almost never wins still pays at most ×50 */
    static readonly MAX_ODDS = 5000;

    static readonly ODDS_RUNS = 6000;

    /** Fights simulated between two breaths of the event loop */
    static readonly ODDS_BATCH = 500;

    /** Instance values, so tests can shorten them */
    public timings = { betMs: 20_000, lastCallMs: 5000, introMs: 1500, beatMs: 1200, resultsMs: 6000 };

    /** Overridable for tests: a whole number in [0, max). Only for the monkeys and the real fight */
    public random: (max: number) => number = (max) => randomInt(max);

    private phase: MonkeyFightPhase = 'betting';

    private fight = 0;

    private monkeys: Monkey[] = [];

    private odds: number[] = [];

    private bets: Bet[] = [];

    private events: TimedFightEvent[] | null = null;

    private winner: number | null = null;

    private deadline: number | null = null;

    private startedAt: number | null = null;

    private timer: ReturnType<typeof setTimeout> | undefined;

    private over = false;

    constructor(
        private readonly party: Party,
        private readonly onRoundEnd: () => void,
    ) {}

    public start(): void {
        logFailure(this.openBets());
    }

    public async bet(session: Session, monkey: number, amount: number): Promise<void> {
        if (session.user.isGuest()) {
            throw new Error('Log in to play');
        }
        if (this.phase !== 'betting' || this.over) {
            throw new Error('Wait for the next fight');
        }
        if (!this.monkeys.some((m) => m.id === monkey)) {
            throw new Error('No such monkey');
        }
        this.party.checkBet(amount);
        const seat = this.bets.find((b) => b.session === session);
        if (seat) {
            await this.moveBet(seat, monkey, amount);
        } else {
            if (session.user.money < amount) {
                throw new Error('Not enough money for this bet');
            }
            // Seated before paying: a second bet in the same instant must not go through
            const fresh: Bet = { session, monkey, bet: amount, payout: null };
            this.bets.push(fresh);
            try {
                await UserController.buy(session.user, amount, 'Monkey Fight bet');
            } catch (error) {
                this.bets.splice(this.bets.indexOf(fresh), 1);
                throw error;
            }
        }
        // Everyone has bet: a last call to switch, not an instant start
        const players = this.party.players();
        const lastCallAt = Date.now() + this.timings.lastCallMs;
        if (this.phase === 'betting' && lastCallAt < this.deadline! && players.every((s) => this.bets.some((b) => b.session === s))) {
            this.deadline = lastCallAt;
            this.schedule(this.timings.lastCallMs, () => this.startFight());
        }
        this.broadcast();
    }

    /**
     * Until bets close a bet can go to another monkey or change amount: only the difference moves
     */
    private async moveBet(seat: Bet, monkey: number, amount: number): Promise<void> {
        const before = { monkey: seat.monkey, bet: seat.bet };
        const difference = amount - seat.bet;
        if (difference > 0 && seat.session.user.money < difference) {
            throw new Error('Not enough money for this bet');
        }
        // Changed before paying, so two changes in the same instant can't both charge
        seat.monkey = monkey;
        seat.bet = amount;
        try {
            if (difference > 0) {
                await UserController.buy(seat.session.user, difference, 'Monkey Fight bet');
            } else if (difference < 0) {
                await UserController.giveMoney(seat.session.user, -difference, 'Monkey Fight refund');
            }
        } catch (error) {
            Object.assign(seat, before);
            throw error;
        }
    }

    public async onSessionLeft(session: Session): Promise<void> {
        // Before the fight the bet comes back. After, it stays on the monkey
        const seat = this.bets.find((b) => b.session === session);
        if (seat && this.phase === 'betting') {
            this.bets.splice(this.bets.indexOf(seat), 1);
            await UserController.giveMoney(session.user, seat.bet, 'Monkey Fight refund');
            this.broadcast();
        }
    }

    public syncConnections(connections: Connection[]): void {
        const payload = this.sanitized();
        connections.forEach((connection) => connection.send('monkey-fight', payload));
    }

    /**
     * Called when the round ends or the channel is deleted: bets not settled yet are refunded
     */
    public async destroy(): Promise<void> {
        this.over = true;
        clearTimeout(this.timer);
        await Promise.all(
            this.bets.filter((b) => b.payout === null).map((b) => UserController.giveMoney(b.session.user, b.bet, 'Monkey Fight refund')),
        );
        this.bets = [];
    }

    public sanitized(): SanitizedMonkeyFight {
        const betting = this.phase === 'betting';
        return {
            channelId: this.party.channel.id,
            phase: this.phase,
            fight: this.fight,
            fights: MonkeyFight.FIGHTS,
            deadline: this.deadline,
            startedAt: this.startedAt,
            minBet: this.party.options.minBet,
            maxBet: this.party.options.maxBet,
            monkeys: this.monkeys.map((monkey) => ({ ...monkey, trait: betting ? null : monkey.trait, odds: this.odds[monkey.id] })),
            events: betting ? null : this.events,
            bets: this.bets.map(({ session, monkey, bet, payout }) => ({ user: session.user.sanitized(), monkey, bet, payout })),
        };
    }

    /**
     * Each monkey's odds, from how often it wins thousands of fights. Not drawn from `random`, so tests stay scripted
     */
    public async computeOdds(monkeys: Monkey[]): Promise<number[]> {
        const wins = monkeys.map(() => 0);
        const roll = (max: number) => Math.floor(Math.random() * max);
        for (let i = 0; i < MonkeyFight.ODDS_RUNS; i++) {
            // A breath every few hundred fights, so the server keeps answering everyone else meanwhile
            if (i % MonkeyFight.ODDS_BATCH === 0) {
                await new Promise((resolve) => setImmediate(resolve));
            }
            wins[simulate(monkeys, roll).winner]++;
        }
        return wins.map((count) => {
            const chance = Math.max(count / MonkeyFight.ODDS_RUNS, 0.002);
            return Math.max(101, Math.min(MonkeyFight.MAX_ODDS, Math.floor((100 * (1 - MonkeyFight.HOUSE_EDGE)) / chance)));
        });
    }

    private drawMonkeys(): Monkey[] {
        const pick = <T>(list: T[]) => list[this.random(list.length)];
        const range = (min: number, max: number) => min + this.random(max - min + 1);
        // Distinct last names and traits: two monkeys never share a name, every fight is a different mix
        const names = shuffle([...LAST_NAMES], this.random)
            .slice(0, MonkeyFight.MONKEYS)
            .map((name) => `${pick(FIRST_NAMES)} ${name}`);
        const traits = shuffle([...TRAITS], this.random);
        return names.map((name, id) => ({
            id,
            name,
            skin: {
                fur: this.random(SKINS.fur),
                face: this.random(SKINS.face),
                accessory: this.random(SKINS.accessory),
                eyes: this.random(SKINS.eyes),
            },
            stats: { hp: range(70, 130), attack: range(12, 24), defense: range(0, 10), speed: range(6, 14) },
            trait: traits[id],
        }));
    }

    private async openBets(): Promise<void> {
        const monkeys = this.drawMonkeys();
        // Priced before anything changes: bets stay closed until the odds are known
        const odds = await this.computeOdds(monkeys);
        if (this.over) {
            return;
        }
        this.phase = 'betting';
        this.fight++;
        this.bets = [];
        this.events = null;
        this.winner = null;
        this.startedAt = null;
        this.monkeys = monkeys;
        this.odds = odds;
        this.deadline = Date.now() + this.timings.betMs;
        // Nobody bet: the round is over
        this.schedule(this.timings.betMs, () => (this.bets.length ? this.startFight() : this.end()));
        this.broadcast();
    }

    private startFight(): void {
        if (this.phase !== 'betting' || this.over) {
            return;
        }
        // Rolled only now, so nothing about the fight exists while bets are open
        const { events, winner } = simulate(this.monkeys, this.random);
        this.phase = 'fighting';
        this.deadline = null;
        this.events = this.timeline(events);
        this.winner = winner;
        this.startedAt = Date.now() + this.timings.introMs;
        // Paid once the last punch has played, so balances don't give the winner away
        const last = this.events.at(-1);
        this.schedule(this.timings.introMs + (last ? last.at + last.duration : 0) + this.timings.beatMs, () => logFailure(this.settle()));
        this.broadcast();
    }

    /**
     * Crits hold a little longer, KOs play in slow motion, the last one longest
     */
    private timeline(events: FightEvent[]): TimedFightEvent[] {
        let at = 0;
        return events.map((event, index) => {
            const weight = event.ko ? (index === events.length - 1 ? 3 : 2) : event.kind === 'crit' ? 1.4 : 1;
            const timed = { ...event, at, duration: Math.round(this.timings.beatMs * weight) };
            at += timed.duration;
            return timed;
        });
    }

    private async settle(): Promise<void> {
        if (this.over) {
            return;
        }
        this.phase = 'done';
        for (const seat of this.bets) {
            seat.payout = seat.monkey === this.winner ? Math.floor((seat.bet * this.odds[seat.monkey]) / 100) : 0;
        }
        this.broadcast();
        await Promise.all(
            this.bets.filter((b) => b.payout).map((b) => UserController.giveMoney(b.session.user, b.payout!, 'Monkey Fight win')),
        );
        this.schedule(this.timings.resultsMs, () => (this.fight >= MonkeyFight.FIGHTS ? this.end() : logFailure(this.openBets())));
    }

    private end(): void {
        if (this.over) {
            return;
        }
        this.over = true;
        clearTimeout(this.timer);
        logFailure(Promise.resolve().then(this.onRoundEnd));
    }

    private schedule(ms: number, fn: () => void): void {
        clearTimeout(this.timer);
        this.timer = setTimeout(fn, ms);
    }

    private broadcast(): void {
        if (!this.over) {
            this.syncConnections(this.party.connections());
        }
    }
}
