/**
 * The party games, in lobby order: how they show, the event their state comes in, and the client state key it lands in
 */
export const PARTY_GAMES = {
    blackjack: {
        emoji: '🃏',
        name: 'Blackjack',
        pitch: 'Beat the dealer to 21. Blackjack pays 3:2.',
        event: 'casino-table',
        state: 'casino',
    },
    luckypop: {
        emoji: '🎈',
        name: 'Lucky Pop',
        pitch: 'Pop balloons for cash, or a nasty surprise.',
        event: 'lucky-pop',
        state: 'luckyPop',
    },
    crash: { emoji: '🚀', name: 'Crash', pitch: 'Cash out before the multiplier crashes.', event: 'crash', state: 'crash' },
    dailyroll: {
        emoji: '🎴',
        name: 'Daily Roll',
        pitch: 'A free card a day. One of them holds $80.',
        event: 'daily-roll',
        state: 'dailyRoll',
    },
    monkeys: {
        emoji: '🐒',
        name: 'Monkey Fight',
        pitch: 'Back the monkey you think stays standing.',
        event: 'monkey-fight',
        state: 'monkeyFight',
    },
    // Played against each other, so it takes two people wanting it
    potato: {
        emoji: '💣',
        name: 'Hot Potato',
        pitch: 'Pass the bomb before it blows up on you.',
        event: 'hot-potato',
        state: 'hotPotato',
        minVotes: 2,
    },
    plinko: { emoji: '🪙', name: 'Plinko', pitch: 'Drop a ball, dream of the jackpot.', event: 'plinko', state: 'plinko' },
    roulette: { emoji: '🎡', name: 'Roulette', pitch: 'Red, black or your lucky number.', event: 'roulette', state: 'roulette' },
} as const;

export type PartyGameId = keyof typeof PARTY_GAMES;

/** Votes a game needs to win the vote */
export const minVotes = (game: PartyGameId): number => {
    const entry = PARTY_GAMES[game];
    return 'minVotes' in entry ? entry.minVotes : 1;
};
