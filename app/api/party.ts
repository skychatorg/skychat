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
    potato: { emoji: '💣', name: 'Hot Potato', pitch: 'Pass the bomb before it blows up on you.', event: 'hot-potato', state: 'hotPotato' },
} as const;

export type PartyGameId = keyof typeof PARTY_GAMES;
