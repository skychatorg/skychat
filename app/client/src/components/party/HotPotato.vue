<script setup>
import CasinoChip from '@/components/casino/CasinoChip.vue';
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';
import { useCountdown } from '@/composables/useCountdown';
import { useNow } from '@/composables/useNow';
import { playCasinoSound } from '@/lib/casinoSounds';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { betChips } from '@/lib/channel';
import { formatMoney } from '../../../../api/money.ts';
import { computed, onUnmounted, watch } from 'vue';

const CHIP_COLORS = ['#c9452f', '#2f6db0', '#2e8655', '#26222a', '#8a3fb0'];
/** The fizz is at its worst after this long, the real fuse is hidden and random */
const HEAT_MS = 20_000;

const app = useAppStore();
const client = useClientStore();
const now = useNow(50);

const game = computed(() => client.state.hotPotato);
const me = computed(() => client.state.user);
const mySeat = computed(() => game.value.players.findIndex((p) => p.user.id === me.value.id));
const joined = computed(() => mySeat.value !== -1);
const { seconds: joinSeconds } = useCountdown(() => game.value.deadline);

let offset = 0;
watch(
    () => game.value.now,
    (serverNow) => (offset = serverNow - Date.now()),
    { immediate: true },
);
const serverNow = computed(() => now.value + offset);

const holding = computed(() => game.value.phase === 'playing' && game.value.holder === mySeat.value);
const holdLeft = computed(() => Math.max(0, (game.value.canPassAt ?? 0) - serverNow.value));
const canPass = computed(() => holding.value && holdLeft.value === 0);
// How hard the bomb fizzes: it only ever gets worse
const heat = computed(() => (game.value.phase === 'playing' ? Math.min(1, (serverNow.value - game.value.startedAt) / HEAT_MS) : 0));

/**
 * Seats spread evenly around the circle, first one on top. While joining, one more empty seat waits for the next player
 */
const seats = computed(() => {
    const players = game.value.players.map((player, index) => ({ ...player, index }));
    const spots = game.value.phase === 'joining' ? [...players, null] : players;
    return spots.map((player, i) => {
        const angle = ((-90 + (i * 360) / spots.length) * Math.PI) / 180;
        const at = { x: 50 + 38 * Math.cos(angle), y: 52 + 34 * Math.sin(angle) };
        if (!player) {
            return { placeholder: true, key: 'join', ...at };
        }
        const { index } = player;
        const holder = game.value.holder === index;
        const loser = game.value.loser === index;
        return {
            ...player,
            ...at,
            key: player.user.id,
            mine: index === mySeat.value,
            holder,
            loser,
            // Pickable during the hold too: the bomb goes there the moment the hold ends
            target: holding.value && !holder,
            aimed: game.value.phase === 'playing' && game.value.aim === index,
        };
    });
});

// The bomb sits between its holder and the middle, and flies on every pass
const bomb = computed(() => {
    const seat = seats.value.find((s) => !s.placeholder && s.index === (game.value.loser ?? game.value.holder));
    if (!seat || game.value.phase === 'joining') {
        return null;
    }
    return { x: seat.x + (50 - seat.x) * 0.32, y: seat.y + (52 - seat.y) * 0.32 };
});

// Everything this player held the bomb this round, counting the hold going on right now
const heldMs = (seat) =>
    seat.heldMs +
    (seat.holder && game.value.phase === 'playing' && game.value.heldSince ? Math.max(0, serverNow.value - game.value.heldSince) : 0);

const name = (index) => game.value.players[index]?.user.username ?? '?';
const passes = computed(() =>
    game.value.passes
        .slice(-2)
        .reverse()
        .map((p) => `${name(p.from)} → ${name(p.to)}`),
);

const choices = computed(() => betChips(game.value));
const chipColor = (value) => CHIP_COLORS[Math.max(0, choices.value.indexOf(value)) % CHIP_COLORS.length];
const join = (amount) => client.sendMessage(`/party join ${amount}`);
const pass = (seat) => seat.target && client.sendMessage(`/party pass ${seat.index}`);

const status = computed(() => {
    const { phase, players, minPlayers, loser } = game.value;
    if (phase === 'joining') {
        const missing = Math.max(0, minPlayers - players.length);
        return missing
            ? `${missing} more player${missing === 1 ? '' : 's'} needed · ${joinSeconds.value}s`
            : `Starts in ${joinSeconds.value}s`;
    }
    if (phase === 'playing') {
        return holding.value ? 'YOU HAVE THE BOMB' : `${name(game.value.holder)} has the bomb`;
    }
    return `💥 BOOM! ${name(loser)} was holding it`;
});

const hint = computed(() => {
    const { phase, stake } = game.value;
    if (!me.value.id) {
        return 'Log in to play';
    }
    if (phase === 'joining') {
        return joined.value ? `You're in for ${formatMoney(stake)}. Waiting for the others…` : null;
    }
    if (phase === 'playing') {
        if (!joined.value) {
            return 'Watching this round';
        }
        // Holding longer is a bigger cut if you survive: greed against safety
        if (!holding.value) {
            return 'Pray it skips you';
        }
        if (game.value.aim !== null && !canPass.value) {
            return `Going to ${name(game.value.aim)} when the hold ends…`;
        }
        return canPass.value ? 'Pass it, or hold on for a bigger cut…' : 'Pick who gets it next…';
    }
    const mine = game.value.players[mySeat.value];
    if (!mine) {
        return null;
    }
    if (game.value.loser === mySeat.value) {
        return `It blew up on you: your ${formatMoney(stake)} stake is gone`;
    }
    return `You survived and get ${formatMoney(mine.payout ?? 0)} for your ${formatMoney(stake)} stake`;
});

// Sounds: a tick that speeds up as the bomb heats, a swish on every pass, and the boom
const sound = (name, delayMs) => app.casinoSound && playCasinoSound(name, delayMs);
let ticker = null;
const tick = () => {
    sound('tick');
    ticker = setTimeout(tick, 700 - 560 * heat.value);
};
watch(
    () => game.value.phase === 'playing' && app.casinoSound,
    (on) => {
        clearTimeout(ticker);
        if (on) {
            tick();
        }
    },
    { immediate: true },
);
onUnmounted(() => clearTimeout(ticker));
watch(
    () => game.value.passes.length,
    (count, before) => count > before && sound('whoosh'),
);
watch(holding, (value) => value && sound('chip', 150));
watch(
    () => game.value.players.length,
    (count, before) => game.value.phase === 'joining' && count > before && sound('chip'),
);
watch(
    () => game.value.phase,
    (phase, before) => {
        if (phase === 'done' && before === 'playing') {
            sound('boom');
            if (joined.value) {
                sound(game.value.loser === mySeat.value ? 'lose' : 'win', 700);
            }
        }
    },
);
</script>

<template>
    <div class="potato">
        <div class="frame" :class="game.phase">
            <div class="top">
                <span class="title">💣 Hot Potato</span>
                <span class="status" :class="{ alarm: holding }" aria-live="polite">{{ status }}</span>
                <span class="pot">Pot {{ formatMoney(game.pot) }}</span>
                <button
                    class="mute"
                    :title="app.casinoSound ? 'Mute the game' : 'Turn game sounds on'"
                    :aria-pressed="!app.casinoSound"
                    @click="app.toggleCasinoSound()"
                >
                    <fa :icon="app.casinoSound ? 'volume-high' : 'volume-xmark'" />
                </button>
            </div>

            <div class="table" :class="{ boom: game.phase === 'done' }">
                <div class="center">
                    <span class="center-pot">{{ formatMoney(game.pot) }}</span>
                    <span class="center-sub">
                        {{ game.players.length }} player{{ game.players.length === 1 ? '' : 's'
                        }}<template v-if="game.phase !== 'joining'">
                            · {{ game.passCount }} pass{{ game.passCount === 1 ? '' : 'es' }}</template
                        >
                    </span>
                    <!-- The whole game in three lines, while people decide to join -->
                    <ul v-if="game.phase === 'joining'" class="rules">
                        <li>
                            💣 Hold it at least {{ game.holdMs / 1000 }}s, then pass it on. A pass costs {{ formatMoney(game.passFee) }},
                            into the pot
                        </li>
                        <li>💥 Holding it when it blows? Your stake is gone</li>
                        <li>💰 Everyone else shares the pot, by how long each held the bomb</li>
                    </ul>
                </div>

                <template v-for="seat in seats" :key="seat.key">
                    <div v-if="seat.placeholder" class="seat placeholder" :style="{ left: `${seat.x}%`, top: `${seat.y}%` }">
                        <button
                            class="face"
                            :disabled="joined || !game.stake || !me.id || me.money < game.stake"
                            :title="game.stake ? `Join for ${formatMoney(game.stake)}` : 'Pick a stake'"
                            @click="join(game.stake)"
                        >
                            +
                        </button>
                        <!-- No stake yet: the first player picks it right here, at the seat -->
                        <span v-if="!game.stake && !joined && me.id" class="stakes" role="group" aria-label="Pick a stake">
                            <button
                                v-for="choice in choices"
                                :key="choice"
                                class="stake-pick"
                                :disabled="me.money < choice"
                                :title="`Join with a ${formatMoney(choice)} stake`"
                                @click="join(choice)"
                            >
                                <CasinoChip :value="choice" :color="chipColor(choice)" />
                            </button>
                        </span>
                        <span v-else class="who">{{
                            joined ? 'waiting…' : game.stake ? `Join ${formatMoney(game.stake)}` : 'open seat'
                        }}</span>
                    </div>
                    <button
                        v-else
                        class="seat"
                        :class="{ mine: seat.mine, holder: seat.holder, loser: seat.loser, target: seat.target, aimed: seat.aimed }"
                        :style="{ left: `${seat.x}%`, top: `${seat.y}%` }"
                        :disabled="!seat.target"
                        :aria-label="seat.target ? `Pass the bomb to ${seat.user.username}` : seat.user.username"
                        @click="pass(seat)"
                    >
                        <span class="face">
                            <UserMiniAvatar :user="seat.user" class="avatar" />
                            <span v-if="game.stake" class="stake"><CasinoChip :value="game.stake" :color="chipColor(game.stake)" /></span>
                            <span v-if="seat.loser" class="dead" aria-hidden="true">💀</span>
                        </span>
                        <span class="who" :style="{ color: seat.user.data?.plugins?.custom?.color }">{{ seat.user.username }}</span>
                        <span class="money">{{ formatMoney(seat.user.money) }}</span>
                        <span v-if="game.phase !== 'joining'" class="held" :class="{ live: seat.holder && game.phase === 'playing' }">
                            held {{ (heldMs(seat) / 1000).toFixed(1) }}s
                        </span>
                        <span v-if="game.phase === 'done'" class="payout" :class="{ lost: seat.loser }">
                            {{ seat.loser ? `−${formatMoney(game.stake)}` : `+${formatMoney(seat.payout ?? 0)}` }}
                        </span>
                    </button>
                </template>

                <div v-if="bomb" class="bomb" :style="{ left: `${bomb.x}%`, top: `${bomb.y}%`, '--heat': heat }" aria-hidden="true">
                    <span v-if="game.phase === 'done'" class="blast">💥</span>
                    <template v-else>
                        <span class="spark">✨</span>
                        <span class="bomb-body">💣</span>
                    </template>
                </div>
            </div>

            <div class="bottom">
                <button
                    v-if="game.phase === 'joining' && !joined && game.stake && me.id"
                    class="chip join"
                    :disabled="me.money < game.stake"
                    @click="join(game.stake)"
                >
                    Join for {{ formatMoney(game.stake) }}
                </button>
                <p v-else-if="hint" class="hint" :class="{ alarm: holding }">{{ hint }}</p>
                <span v-if="holding" class="hold" aria-hidden="true">
                    <span :style="{ transform: `scaleX(${1 - holdLeft / game.holdMs})` }"></span>
                </span>
                <ol v-if="game.phase !== 'joining'" class="feed" aria-label="Last passes">
                    <li v-for="(line, i) in passes" :key="line + i">{{ line }}</li>
                </ol>
            </div>
        </div>
    </div>
</template>

<style scoped>
.potato {
    container-type: size;
    width: 100%;
    height: 100%;
}
.frame {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: radial-gradient(ellipse at 50% 55%, #3a2412, #120d0a 75%);
    color: #f4ece4;
}
.top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: clamp(3px, 1.5cqh, 10px) clamp(8px, 2cqw, 20px);
    font-size: clamp(12px, 3.6cqh, 15px);
}
.title {
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #ff8a3d;
    white-space: nowrap;
}
.status {
    flex: 1;
    min-width: 0;
    color: rgb(255 255 255 / 0.75);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.status.alarm,
.hint.alarm {
    color: #ff5a3d;
    font-weight: 900;
}
.pot {
    font:
        800 clamp(12px, 3.6cqh, 15px) ui-monospace,
        monospace;
    color: #ffc21a;
    white-space: nowrap;
}
.mute {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 8px;
    color: rgb(255 255 255 / 0.7);
}
.mute:hover {
    background: rgb(255 255 255 / 0.1);
}
.table {
    position: relative;
    flex: 1;
    min-height: 0;
    --s: clamp(26px, 13cqh, 64px);
}
/* The table itself */
.table::before {
    content: '';
    position: absolute;
    left: 18%;
    right: 18%;
    top: 22%;
    bottom: 18%;
    border-radius: 50%;
    background: radial-gradient(ellipse, #5a3a1c, #2a1a0c 70%);
    box-shadow:
        inset 0 0 30px rgb(0 0 0 / 0.6),
        0 0 0 4px #1e140b;
}
.center {
    position: absolute;
    left: 50%;
    top: 52%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
}
.center-pot {
    font:
        900 clamp(16px, 8cqh, 40px) ui-monospace,
        monospace;
    color: #ffc21a;
    text-shadow: 0 2px 8px rgb(0 0 0 / 0.6);
}
.center-sub {
    font-size: clamp(10px, 3cqh, 13px);
    color: rgb(255 255 255 / 0.6);
}
.rules {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    font-size: clamp(10px, 2.8cqh, 12px);
    line-height: 1.5;
    color: rgb(255 255 255 / 0.75);
    text-align: center;
    white-space: nowrap;
}
.seat {
    position: absolute;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transition:
        left 0.45s cubic-bezier(0.4, 0, 0.2, 1),
        top 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}
.seat:disabled {
    cursor: default;
}
.face {
    position: relative;
    width: var(--s);
    height: var(--s);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: rgb(255 255 255 / 0.06);
    border: 2px solid transparent;
    font-size: calc(var(--s) * 0.5);
    line-height: 1;
    transition:
        border-color 0.15s,
        transform 0.15s,
        box-shadow 0.15s;
}
/* The user preview, as at the blackjack table */
.avatar {
    width: 100% !important;
    height: 100% !important;
    border-radius: 8px !important;
}
.stake {
    position: absolute;
    right: calc(var(--s) * -0.3);
    bottom: calc(var(--s) * -0.2);
    width: calc(var(--s) * 0.5);
    aspect-ratio: 1;
}
.dead {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(var(--s) * 0.6);
    background: rgb(0 0 0 / 0.55);
    border-radius: 8px;
}
.held {
    font:
        600 clamp(9px, 2.6cqh, 11px) ui-monospace,
        monospace;
    color: rgb(255 255 255 / 0.5);
}
.held.live {
    color: #ff8a3d;
}
.money {
    font:
        600 clamp(9px, 2.8cqh, 12px) ui-monospace,
        monospace;
    color: #ffc21a;
}
.stakes {
    display: flex;
    gap: 4px;
    margin-top: 2px;
}
.stake-pick {
    width: clamp(24px, 9cqh, 40px);
    aspect-ratio: 1;
    transition: transform 0.15s;
}
.stake-pick:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.1);
}
.stake-pick:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}
.who {
    max-width: calc(var(--s) * 2.2);
    font-size: clamp(10px, 3cqh, 13px);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgb(255 255 255 / 0.8);
}
.seat.mine .face {
    border-color: rgb(var(--color-primary));
}
.seat.mine .who {
    color: #fff;
}
.seat.holder .face {
    border-color: #ff5a3d;
    box-shadow: 0 0 18px rgb(255 90 61 / 0.6);
}
/* Who you can pass to: they light up and grow under the cursor */
.seat.target {
    cursor: pointer;
}
.seat.target .face {
    border-color: #ffc21a;
    border-style: dashed;
}
/* Picked during the hold: it leaves for this seat the moment the hold ends */
.seat.aimed .face {
    border-style: solid;
    border-color: #ffc21a;
    box-shadow: 0 0 18px rgb(255 194 26 / 0.7);
    transform: scale(1.1);
}
.seat.target:hover .face {
    transform: scale(1.15);
    box-shadow: 0 0 16px rgb(255 194 26 / 0.6);
}
.placeholder .face {
    border-color: rgb(255 255 255 / 0.3);
    border-style: dashed;
    background: none;
    color: rgb(255 255 255 / 0.5);
    font-size: calc(var(--s) * 0.5);
}
.placeholder .face:disabled {
    cursor: default;
}
.placeholder .face:not(:disabled):hover {
    border-color: #ffc21a;
    color: #ffc21a;
}
.payout {
    font:
        800 clamp(11px, 3.4cqh, 15px) ui-monospace,
        monospace;
    color: #7bd88f;
}
.payout.lost {
    color: #ff5a5f;
}
.bomb {
    position: absolute;
    transform: translate(-50%, -50%);
    font-size: calc(var(--s) * 0.9);
    line-height: 1;
    pointer-events: none;
    z-index: 2;
    transition:
        left 0.35s cubic-bezier(0.3, 0, 0.3, 1),
        top 0.35s cubic-bezier(0.3, 0, 0.3, 1);
}
.bomb-body {
    display: block;
    filter: drop-shadow(0 0 calc(4px + var(--heat) * 14px) rgb(255 90 40 / calc(0.3 + var(--heat) * 0.6)));
}
.spark {
    position: absolute;
    top: -40%;
    right: -30%;
    font-size: 0.5em;
}
.blast {
    display: block;
    font-size: 2.4em;
}
.bottom {
    height: clamp(30px, 14cqh, 64px);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 clamp(8px, 2cqw, 20px);
    overflow: hidden;
}
.chips {
    display: flex;
    align-items: center;
    gap: 6px;
}
.label {
    font-size: 13px;
    font-weight: 700;
    margin-right: 4px;
}
.chip {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 10px;
    font-weight: 800;
    white-space: nowrap;
    background: rgb(255 138 61 / 0.15);
    border: 1px solid rgb(255 138 61 / 0.55);
}
.chip:hover:not(:disabled) {
    background: rgb(255 138 61 / 0.3);
}
.chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.hint {
    margin: 0;
    font-size: 13px;
    color: rgb(255 255 255 / 0.8);
    white-space: nowrap;
}
.hold {
    width: 120px;
    height: 6px;
    border-radius: 3px;
    background: rgb(255 255 255 / 0.12);
    overflow: hidden;
}
.hold span {
    display: block;
    height: 100%;
    background: #ffc21a;
    transform-origin: left;
}
.feed {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    text-align: right;
    font-size: 12px;
    color: rgb(255 255 255 / 0.5);
}
.feed li {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.feed li:first-child {
    color: #f4ece4;
    font-weight: 700;
}
@media (prefers-reduced-motion: no-preference) {
    .playing .bomb-body {
        animation: fizz calc(0.6s - var(--heat) * 0.5s) linear infinite;
    }
    .spark {
        animation: flicker 0.18s steps(2) infinite;
    }
    .seat.holder .face {
        animation: sweat 0.4s ease-in-out infinite;
    }
    .blast {
        animation: blast 0.6s ease-out both;
    }
    .table.boom {
        animation: quake 0.5s linear;
    }
    @keyframes fizz {
        25% {
            transform: rotate(calc(var(--heat) * -14deg - 3deg)) scale(calc(1 + var(--heat) * 0.08));
        }
        75% {
            transform: rotate(calc(var(--heat) * 14deg + 3deg));
        }
    }
    @keyframes flicker {
        50% {
            opacity: 0.2;
        }
    }
    @keyframes sweat {
        50% {
            transform: translateX(2px);
        }
    }
    @keyframes blast {
        from {
            transform: scale(0.2);
            opacity: 1;
        }
        60% {
            transform: scale(1.3);
        }
    }
    @keyframes quake {
        20% {
            transform: translate(-8px, 4px);
        }
        40% {
            transform: translate(7px, -5px);
        }
        60% {
            transform: translate(-5px, 3px);
        }
        80% {
            transform: translate(3px, -2px);
        }
    }
}

/* Short players: no feed, a smaller circle */
@container (max-height: 220px) {
    .feed,
    .mute,
    .center-sub,
    .rules {
        display: none;
    }
    .table {
        --s: clamp(20px, 15cqh, 34px);
    }
}
@container (max-height: 160px) {
    .who {
        display: none;
    }
    .label {
        display: none;
    }
    .chip {
        min-height: 26px;
        padding: 0 6px;
        font-size: 12px;
    }
}
</style>
