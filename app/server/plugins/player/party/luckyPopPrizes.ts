/**
 * What Lucky Pop's balloons cost and hold: the tables the game draws from
 */

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

export type PlainSize = 'xs' | 'md' | 'lg';

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
