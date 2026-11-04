<script setup>
import CasinoTable from '@/components/casino/CasinoTable.vue';
import CrashGame from '@/components/party/CrashGame.vue';
import LuckyPop from '@/components/party/LuckyPop.vue';
import { useCountdown } from '@/composables/useCountdown';
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
    })[game] ?? '';

const lobbyGames = computed(() => Object.entries(PARTY_GAMES).map(([id, game]) => ({ id, ...game, meta: meta(id) })));
const pick = (game) => client.sendMessage(`/party pick ${game}`);

const { seconds: voteSeconds, fraction: voteFraction } = useCountdown(() => party.value.deadline);
// The game just played first, as "Again"
const voteGames = computed(() =>
    Object.keys(PARTY_GAMES)
        .sort((a, b) => (b === party.value.lastGame) - (a === party.value.lastGame))
        .map((id) => {
            const voters = party.value.votes[id] ?? [];
            return {
                id,
                name: PARTY_GAMES[id].name,
                again: id === party.value.lastGame,
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
        </template>

        <section v-else-if="party.phase === 'vote'" class="screen" aria-labelledby="party-vote-title">
            <header class="head">
                <h2 id="party-vote-title" class="title">Next game?</h2>
                <span class="count" aria-hidden="true">{{ voteSeconds }}s</span>
            </header>
            <div class="bar" aria-hidden="true">
                <span :style="{ transform: `scaleX(${voteFraction})` }"></span>
            </div>
            <div class="games">
                <button
                    v-for="game in voteGames"
                    :key="game.id"
                    class="game"
                    :class="{ mine: game.mine }"
                    :aria-pressed="game.mine"
                    :disabled="isGuest"
                    @click="vote(game.id)"
                >
                    <span class="name">{{ game.again ? `Again: ${game.name}` : game.name }}</span>
                    <span class="sub">
                        {{ game.voters.length }} vote{{ game.voters.length === 1 ? '' : 's'
                        }}<template v-if="game.voters.length"> · {{ game.voters.join(', ') }}</template>
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
                <button v-for="game in lobbyGames" :key="game.id" class="game" :disabled="isGuest" @click="pick(game.id)">
                    <span class="name">{{ game.name }}</span>
                    <span class="pitch">{{ game.pitch }}</span>
                    <span class="sub">{{ game.meta }}</span>
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
    border-radius: 3px;
    background: rgb(255 255 255 / 0.1);
    overflow: hidden;
}
.bar span {
    display: block;
    height: 100%;
    background: #f0c46c;
    transform-origin: left;
    transition: transform 0.25s linear;
}
.games {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
    gap: clamp(6px, 2cqw, 16px);
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
    font-weight: 700;
    font-size: clamp(14px, 5cqh, 20px);
}
.pitch {
    color: rgb(255 255 255 / 0.65);
    line-height: 1.4;
    font-size: clamp(12px, 3.5cqh, 15px);
}
.sub {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: rgb(255 255 255 / 0.55);
}
.game.mine .sub {
    color: #f4f4ff;
}
@media (prefers-reduced-motion: reduce) {
    .bar span {
        transition: none;
    }
}

/* Short players: one row, the descriptions go */
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
    .name {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .games {
        flex: 1;
        min-width: 0;
        /* Every game on the one row */
        grid-template-columns: none;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
    }
    .game {
        justify-content: center;
        padding: 6px 10px;
        border-radius: 10px;
    }
}
/* Short and narrow: names only, the lead goes */
@container (max-height: 200px) and (max-width: 520px) {
    .sub,
    .lead {
        display: none;
    }
}
/* Narrow: the cards stack */
@container (max-width: 420px) and (min-height: 201px) {
    .games {
        grid-template-columns: minmax(0, 1fr);
    }
    .pitch {
        display: none;
    }
}
</style>
