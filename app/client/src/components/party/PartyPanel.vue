<script setup>
import DrainBar from '@/components/party/DrainBar.vue';
import CasinoTable from '@/components/casino/CasinoTable.vue';
import CrashGame from '@/components/party/CrashGame.vue';
import DailyRoll from '@/components/party/DailyRoll.vue';
import MonkeyFight from '@/components/party/MonkeyFight.vue';
import HotPotato from '@/components/party/HotPotato.vue';
import LuckyPop from '@/components/party/LuckyPop.vue';
import { useCountdown } from '@/composables/useCountdown';
import { useNow } from '@/composables/useNow';
import { betLimits, PARTY_GAMES } from '@/lib/channel';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const client = useClientStore();

const party = computed(() => client.state.party);
const isGuest = computed(() => !client.state.user.id);
const limits = computed(() => client.currentChannel?.party);

const meta = (game) =>
    ({
        blackjack: limits.value && `bets ${betLimits(limits.value)}`,
        crash: limits.value && `bets ${betLimits(limits.value)} · up to ×100`,
        luckypop: '$1 to $20 a balloon',
        dailyroll: 'free · once a day',
        monkeys: limits.value && `bets ${betLimits(limits.value)} · up to ×50`,
        potato: limits.value && `stake ${betLimits(limits.value)} · 2+ players`,
    })[game] ?? '';

// Daily Roll is locked for the whole channel until 10 PM once played
const now = useNow();
const lockLabel = (id) => {
    const ms = id === 'dailyroll' ? party.value.dailyRollAt - now.value : 0;
    if (ms <= 0) {
        return null;
    }
    const minutes = Math.ceil(ms / 60_000);
    return `back in ${minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`}`;
};

const lobbyGames = computed(() =>
    Object.entries(PARTY_GAMES).map(([id, game]) => ({ id, ...game, meta: meta(id), locked: lockLabel(id) })),
);
const pick = (game) => client.sendMessage(`/party pick ${game}`);

const { seconds: voteSeconds, total: voteTotal } = useCountdown(() => party.value.deadline);
// The game just played first, as "Again"
const voteGames = computed(() =>
    Object.keys(PARTY_GAMES)
        .sort((a, b) => (b === party.value.lastGame) - (a === party.value.lastGame))
        .map((id) => {
            const voters = party.value.votes[id] ?? [];
            return {
                id,
                name: PARTY_GAMES[id].name,
                emoji: PARTY_GAMES[id].emoji,
                again: id === party.value.lastGame,
                locked: lockLabel(id),
                voters,
                mine: voters.includes(client.state.user.username),
            };
        }),
);
const voted = computed(() => voteGames.value.some((game) => game.mine));
const vote = (game) => client.sendMessage(`/party vote ${game}`);
</script>

<template>
    <!-- Only the lobby and vote are sized from this box: the games size themselves, and the blackjack table must see what it always saw -->
    <div class="party" :class="{ sized: party.phase !== 'playing' }">
        <template v-if="party.phase === 'playing'">
            <CasinoTable v-if="party.game === 'blackjack' && client.state.casino" />
            <LuckyPop v-else-if="party.game === 'luckypop' && client.state.luckyPop" />
            <CrashGame v-else-if="party.game === 'crash' && client.state.crash" />
            <DailyRoll v-else-if="party.game === 'dailyroll' && client.state.dailyRoll" />
            <MonkeyFight v-else-if="party.game === 'monkeys' && client.state.monkeyFight" />
            <HotPotato v-else-if="party.game === 'potato' && client.state.hotPotato" />
        </template>

        <section v-else-if="party.phase === 'vote'" class="screen" aria-labelledby="party-vote-title">
            <header class="head">
                <h2 id="party-vote-title" class="title">Next game?</h2>
                <span class="count" aria-hidden="true">{{ voteSeconds }}s</span>
            </header>
            <DrainBar class="bar" :deadline="party.deadline" :ms="voteTotal" />
            <div class="games">
                <button
                    v-for="game in voteGames"
                    :key="game.id"
                    class="game"
                    :class="{ mine: game.mine }"
                    :aria-pressed="game.mine"
                    :disabled="isGuest || Boolean(game.locked)"
                    :title="game.name"
                    @click="vote(game.id)"
                >
                    <span class="name"
                        ><span class="emoji" aria-hidden="true">{{ game.emoji }}</span>
                        <span class="label">{{ game.again ? `Again: ${game.name}` : game.name }}</span></span
                    >
                    <span v-if="game.locked" class="sub">{{ game.locked }}</span>
                    <!-- Only games with votes say so, so they stand out. The empty line keeps every card the same height -->
                    <span v-else class="sub">
                        <template v-if="game.voters.length">
                            {{ game.voters.length }} vote{{ game.voters.length === 1 ? '' : 's' }} · {{ game.voters.join(', ') }}
                        </template>
                        <template v-else>&nbsp;</template>
                    </span>
                </button>
            </div>
            <p class="hint">
                {{ isGuest ? 'Log in to vote.' : voted ? 'You can change your vote until the timer ends.' : 'Most votes wins.' }}
                Nobody votes: back to the lobby.
            </p>
        </section>

        <section v-else class="screen" aria-labelledby="party-lobby-title">
            <header class="head">
                <h2 id="party-lobby-title" class="title">Pick a game</h2>
                <span class="lead">{{ isGuest ? 'Log in to start a game.' : 'It starts for everyone here.' }}</span>
            </header>
            <div class="games">
                <button
                    v-for="game in lobbyGames"
                    :key="game.id"
                    class="game"
                    :disabled="isGuest || Boolean(game.locked)"
                    :title="game.name"
                    @click="pick(game.id)"
                >
                    <span class="name"
                        ><span class="emoji" aria-hidden="true">{{ game.emoji }}</span> <span class="label">{{ game.name }}</span></span
                    >
                    <span class="pitch">{{ game.pitch }}</span>
                    <span class="sub">{{ game.locked ?? game.meta }}</span>
                </button>
            </div>
        </section>
    </div>
</template>

<style scoped>
/* Sized from its own box like the blackjack table, so it fits every player size, cinema mode and phones */
.party {
    width: 100%;
    height: 100%;
    background: radial-gradient(ellipse at 50% 0%, #26304a, #15161c 70%);
    color: #f4f4ff;
}
.sized {
    container-type: size;
}
.screen {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(6px, 3cqh, 20px);
    padding: clamp(8px, 4cqh, 36px) clamp(12px, 4cqw, 48px);
    overflow: hidden;
}
.head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}
.title {
    margin: 0;
    font-size: clamp(15px, 6cqh, 28px);
    font-weight: 700;
}
.lead,
.hint {
    margin: 0;
    color: rgb(255 255 255 / 0.6);
    font-size: clamp(12px, 3.5cqh, 15px);
}
.count {
    font-family: ui-monospace, monospace;
    font-size: clamp(15px, 6cqh, 26px);
    color: #f0c46c;
}
.bar {
    height: 5px;
}
.games {
    display: grid;
    /* Three by two when there is room, the rules below take over otherwise */
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(6px, 2cqw, 16px);
    min-height: 0;
    /* Last resort only: the rules below make the cards fit first */
    overflow-y: auto;
}
.game {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: clamp(2px, 1.5cqh, 10px);
    min-height: 44px;
    padding: clamp(8px, 3cqh, 20px);
    border-radius: 14px;
    text-align: left;
    background: rgb(255 255 255 / 0.06);
    border: 2px solid rgb(255 255 255 / 0.12);
    transition:
        border-color 0.15s,
        background 0.15s;
}
.game:hover:not(:disabled) {
    background: rgb(255 255 255 / 0.1);
    border-color: rgb(255 255 255 / 0.3);
}
.game:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}
.game.mine {
    border-color: rgb(var(--color-primary));
    background: rgb(var(--color-primary) / 0.12);
}
.name {
    max-width: 100%;
    font-weight: 700;
    font-size: clamp(14px, 5cqh, 20px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pitch {
    color: rgb(255 255 255 / 0.65);
    line-height: 1.4;
    font-size: clamp(12px, 3.5cqh, 15px);
}
.sub {
    max-width: 100%;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: rgb(255 255 255 / 0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.game.mine .sub {
    color: #f4f4ff;
}

/* Not much height: the descriptions go first, the cards stay readable */
@container (max-height: 300px) {
    .pitch {
        display: none;
    }
    .game {
        padding: clamp(6px, 2cqh, 12px) clamp(8px, 2cqw, 14px);
        gap: 2px;
    }
}
/* Medium width: two per row, three rows */
@container (max-width: 700px) and (min-height: 201px) {
    .games {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
/* Medium width without the height for three full rows */
@container (max-width: 700px) and (max-height: 520px) {
    .pitch {
        display: none;
    }
    .game {
        padding: clamp(6px, 2cqh, 12px) clamp(8px, 2cqw, 14px);
        gap: 2px;
    }
    .name {
        font-size: clamp(13px, 4cqh, 17px);
    }
}
/* Narrow, like a phone: still two per row, name and limits only */
@container (max-width: 420px) and (min-height: 201px) {
    .pitch,
    .lead {
        display: none;
    }
    .name {
        font-size: 14px;
    }
    .sub {
        font-size: 11px;
    }
}

/* Short players: every game on one row, no descriptions */
@container (max-height: 200px) {
    .screen {
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        gap: 10px;
        padding-block: 6px;
    }
    .head {
        flex-direction: column;
        gap: 0;
        flex-shrink: 0;
    }
    .pitch,
    .hint,
    .bar {
        display: none;
    }
    .games {
        flex: 1;
        min-width: 0;
        grid-template-columns: none;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        overflow: visible;
    }
    .game {
        justify-content: center;
        padding: 6px 10px;
        border-radius: 10px;
    }
    .name {
        font-size: 14px;
    }
}
/* Short: in one row, the limits and the lead go, names may take two lines rather than be cut */
@container (max-height: 200px) and (max-width: 1100px) {
    .sub,
    .lead {
        display: none;
    }
    .name {
        white-space: normal;
        line-height: 1.15;
        text-align: center;
        font-size: 13px;
    }
    .game {
        align-items: center;
        padding: 6px 4px;
    }
}
/* Short and narrow: the emoji alone says which game, the full name is in the tooltip */
@container (max-height: 200px) and (max-width: 560px) {
    .label {
        display: none;
    }
    .game {
        align-items: center;
        padding: 6px 4px;
    }
    .emoji {
        font-size: 20px;
    }
}
</style>
