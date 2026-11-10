<script setup>
import { useCountdown } from '@/composables/useCountdown';
import { playCasinoSound } from '@/lib/casinoSounds';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { formatMoney } from '../../../../api/money.ts';
import { computed, watch } from 'vue';

const app = useAppStore();
// Muted per game: one game's noise shouldn't silence the others
const soundOn = computed(() => app.gameSound('dailyroll'));
const client = useClientStore();

const board = computed(() => client.state.dailyRoll);
const me = computed(() => client.state.user.username);
const isGuest = computed(() => !client.state.user.id);
const { seconds, total } = useCountdown(() => board.value.deadline);

const mine = computed(() => board.value.cards.find((card) => card.username === me.value) ?? null);
const picked = computed(() => board.value.cards.filter((card) => card.username).length);
const canPick = computed(() => board.value.phase === 'picking' && !isGuest.value);
const jackpotCard = computed(() => board.value.cards.find((card) => card.amount === board.value.jackpot) ?? null);
// A big card someone holds, but not the jackpot: still a win worth a show
const isBig = (card) => card.amount !== null && card.amount >= board.value.bigWin && card.amount !== board.value.jackpot;
const bigWinner = computed(() => board.value.cards.filter((card) => isBig(card) && card.username).at(-1) ?? null);
const suspenseCard = computed(() => board.value.cards.find((card) => card.id === board.value.suspense) ?? null);
// The last seconds of picking get loud
const hurry = computed(() => board.value.phase === 'picking' && seconds.value <= 10);

const status = computed(() => {
    const { phase } = board.value;
    if (phase === 'picking') {
        const you = isGuest.value ? 'log in to pick' : mine.value ? 'click another card to switch' : 'pick a free card';
        return `${picked.value} picked · ${you}`;
    }
    if (phase === 'countdown') {
        return 'Picks are closed';
    }
    if (suspenseCard.value) {
        return suspenseCard.value.username === me.value ? 'Your card…' : `${suspenseCard.value.username}'s card…`;
    }
    if (jackpotCard.value?.username) {
        return `💰 ${jackpotCard.value.username} hit the jackpot!`;
    }
    if (bigWinner.value) {
        return `🎉 ${bigWinner.value.username} won ${formatMoney(bigWinner.value.amount)}!`;
    }
    if (jackpotCard.value) {
        return '💰 the jackpot was in nobody’s hand';
    }
    return '💰 the jackpot is still hiding…';
});

const banner = computed(() => {
    if (board.value.phase !== 'done') {
        return null;
    }
    if (!mine.value) {
        return { text: 'Back tomorrow after 10 PM', kind: 'none' };
    }
    if (mine.value.amount === board.value.jackpot) {
        return { text: `JACKPOT! You won ${formatMoney(mine.value.amount)}`, kind: 'jackpot' };
    }
    if (isBig(mine.value)) {
        return { text: `BIG WIN! You won ${formatMoney(mine.value.amount)}`, kind: 'big' };
    }
    return mine.value.amount
        ? { text: `You won ${formatMoney(mine.value.amount)}`, kind: 'win' }
        : { text: 'Empty card. Back tomorrow after 10 PM', kind: 'none' };
});

const pick = (card) => {
    if (canPick.value && !card.username) {
        client.sendMessage(`/party card ${card.id}`);
    }
};

const sound = (name) => soundOn.value && playCasinoSound(name);

// Ticks for the last 5 seconds of picking, and each step of the 3, 2, 1
watch(seconds, (left, before) => {
    if (left < before && left > 0 && (board.value.phase === 'countdown' || left <= 5)) {
        sound('tick');
    }
});

// A flip sound for each card, a fanfare for the jackpot, and how it went for yours
watch(
    () => board.value.cards.filter((card) => card.amount !== null).map((card) => card.id),
    (shown, before) => {
        const flipped = board.value.cards.filter((card) => shown.includes(card.id) && !before.includes(card.id));
        for (const card of flipped) {
            if (card.amount === board.value.jackpot) {
                sound('blackjack');
            } else if (isBig(card) && card.username) {
                // Everyone hears a big win, not only the winner
                sound('win');
                sound('sparkle');
            } else if (card.username === me.value) {
                sound(card.amount ? 'win' : 'lose');
            } else {
                sound('flip');
            }
        }
    },
);
</script>

<template>
    <div class="daily">
        <div class="frame" :class="board.phase">
            <div class="top">
                <span class="title">Daily Roll</span>
                <span class="status" aria-live="polite">{{ status }}</span>
                <span v-if="board.phase === 'picking'" class="clock" :class="{ hurry }" aria-hidden="true">{{ seconds }}s</span>
                <button
                    class="mute"
                    :title="soundOn ? 'Mute the game' : 'Turn game sounds on'"
                    :aria-pressed="!soundOn"
                    @click="app.toggleGameSound('dailyroll')"
                >
                    <fa :icon="soundOn ? 'volume-high' : 'volume-xmark'" />
                </button>
            </div>
            <div v-if="board.phase === 'picking'" class="bar" :class="{ hurry }" aria-hidden="true">
                <span :key="board.deadline" :style="{ animationDuration: `${total}ms` }"></span>
            </div>
            <div class="stage">
                <div class="board">
                    <button
                        v-for="card in board.cards"
                        :key="card.id"
                        class="card"
                        :class="{
                            taken: card.username,
                            mine: card.username === me,
                            shown: card.amount !== null,
                            suspense: card.id === board.suspense,
                            jackpot: card.amount === board.jackpot,
                            big: isBig(card),
                            empty: card.amount === 0,
                        }"
                        :aria-disabled="!canPick || Boolean(card.username)"
                        :aria-label="
                            card.amount !== null
                                ? `Card ${card.id + 1}: ${formatMoney(card.amount)}`
                                : card.username
                                ? `Card ${card.id + 1}, ${card.username}`
                                : `Pick card ${card.id + 1}`
                        "
                        @click="pick(card)"
                    >
                        <span class="inner">
                            <span class="face front"><span class="emblem">?</span></span>
                            <span class="face back">{{
                                card.amount === board.jackpot
                                    ? `💰 ${formatMoney(card.amount)}`
                                    : isBig(card)
                                    ? `🎉 ${formatMoney(card.amount)}`
                                    : formatMoney(card.amount ?? 0)
                            }}</span>
                        </span>
                        <!-- Bills fly out of a big card someone holds -->
                        <span v-if="(isBig(card) || card.amount === board.jackpot) && card.username" class="confetti" aria-hidden="true">
                            <span v-for="i in 8" :key="i" :style="{ '--angle': `${i * 45}deg` }">{{ i % 2 ? '💵' : '✨' }}</span>
                        </span>
                        <!-- Inside the card, so picking never moves anything -->
                        <span v-if="card.username" class="who">{{ card.username === me ? 'you' : card.username }}</span>
                    </button>
                </div>
                <div v-if="board.phase === 'countdown'" class="overlay" aria-live="assertive">
                    <span :key="seconds" class="big">{{ seconds }}</span>
                </div>
                <div v-else-if="banner" class="overlay soft">
                    <span class="banner" :class="banner.kind">{{ banner.text }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.daily {
    container-type: size;
    width: 100%;
    height: 100%;
}
.frame {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: radial-gradient(ellipse at 50% 0%, #2c2a48, #13131a 75%);
    color: #f4f4ff;
    transition: background 0.6s;
}
.frame.revealing,
.frame.countdown {
    background: radial-gradient(ellipse at 50% 40%, #241f3d, #0b0b10 80%);
}
.top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: clamp(3px, 1.5cqh, 10px) clamp(8px, 2cqw, 20px);
    font-size: clamp(12px, 3.6cqh, 15px);
}
.title {
    font-weight: 700;
}
.status {
    flex: 1;
    min-width: 0;
    color: rgb(255 255 255 / 0.75);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.clock {
    font-family: ui-monospace, monospace;
    font-weight: 700;
    font-size: clamp(13px, 4.5cqh, 20px);
    color: #f0c46c;
}
.clock.hurry {
    color: #ff8fa3;
}
.mute {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: rgb(255 255 255 / 0.7);
}
.mute:hover {
    background: rgb(255 255 255 / 0.1);
}
.bar {
    height: 4px;
    margin: 0 clamp(8px, 2cqw, 20px) clamp(4px, 1.5cqh, 10px);
    border-radius: 2px;
    background: rgb(255 255 255 / 0.1);
    overflow: hidden;
}
.bar span {
    display: block;
    height: 100%;
    background: #f0c46c;
    transform-origin: left;
    animation: drain linear forwards;
}
@keyframes drain {
    to {
        transform: scaleX(0);
    }
}
.bar.hurry span {
    background: #ff8fa3;
}
.stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
}
.board {
    flex: 1;
    min-width: 0;
    display: grid;
    place-items: center;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    grid-template-rows: repeat(3, minmax(0, 1fr));
    gap: clamp(3px, 1.2cqh, 10px);
    padding: 0 clamp(8px, 2cqw, 20px) clamp(6px, 2cqh, 16px);
}
.card {
    position: relative;
    min-width: 0;
    min-height: 0;
    /* Card-shaped, as big as the cell allows */
    height: 100%;
    max-width: 100%;
    aspect-ratio: 5 / 7;
    justify-self: center;
    perspective: 700px;
    transition: transform 0.18s ease-out;
}
.card[aria-disabled='true'] {
    cursor: default;
}
.inner {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    transition: transform 0.6s cubic-bezier(0.3, 1.4, 0.5, 1);
}
.card.shown .inner {
    transform: rotateY(180deg);
}
.face {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: clamp(5px, 1.6cqh, 10px);
    backface-visibility: hidden;
    font-weight: 800;
    font-size: clamp(11px, 4.5cqh, 22px);
    white-space: nowrap;
    overflow: hidden;
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.4);
}
/* A card back: dark violet, a fine diagonal weave and a thin gold frame */
.front {
    background: radial-gradient(circle at 50% 40%, rgb(255 255 255 / 0.1), transparent 65%),
        repeating-linear-gradient(45deg, rgb(255 255 255 / 0.04) 0 4px, transparent 4px 9px), linear-gradient(160deg, #3b3275, #1d1940);
    box-shadow:
        inset 0 0 0 1px rgb(255 255 255 / 0.14),
        inset 0 0 0 clamp(3px, 1cqh, 5px) #231e4a,
        inset 0 0 0 calc(clamp(3px, 1cqh, 5px) + 1px) rgb(240 196 108 / 0.4),
        0 4px 12px rgb(0 0 0 / 0.4);
    transition: filter 0.18s;
}
.emblem {
    font-family: Georgia, serif;
    font-size: clamp(14px, 7cqh, 34px);
    color: #f0c46c;
    text-shadow: 0 0 12px rgb(240 196 108 / 0.45);
}
.card[aria-disabled='false']:hover {
    transform: translateY(-4px);
}
.card[aria-disabled='false']:hover .front {
    filter: brightness(1.3);
}
.card.taken:not(.mine) .front {
    filter: saturate(0.4) brightness(0.8);
}
.card.mine .face {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
}
.back {
    transform: rotateY(180deg);
    background: linear-gradient(160deg, #24493a, #14281f);
    color: #8ff0a5;
    box-shadow: inset 0 0 0 1px rgb(143 240 165 / 0.35);
}
.card.empty .back {
    background: linear-gradient(160deg, #2a2a33, #1a1a20);
    color: rgb(255 255 255 / 0.35);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1);
}
.card.big .back {
    --glow: rgb(47 191 154 / 0.85);
    background: linear-gradient(135deg, #0f5a4a, #2fbf9a 55%, #0f5a4a);
    color: #eafff8;
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
    box-shadow: inset 0 0 0 2px #8ff0d0;
}
.confetti {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 3;
    pointer-events: none;
}
.confetti span {
    position: absolute;
    font-size: clamp(10px, 4cqh, 20px);
    transform: translate(-50%, -50%);
    opacity: 0;
}
.card.jackpot .back {
    background: linear-gradient(135deg, #6b4e10, #d4a52a 55%, #7a5a12);
    color: #fffbe6;
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
    box-shadow: inset 0 0 0 2px #ffe58a;
}
/* Cards nobody picked fade once the show is on the picked ones */
.frame.done .card.shown:not(.taken),
.frame.revealing .card.shown:not(.taken):not(.jackpot):not(.big) {
    opacity: 0.35;
}
.who {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    padding: 2px 4px;
    border-radius: 0 0 clamp(5px, 1.6cqh, 10px) clamp(5px, 1.6cqh, 10px);
    background: rgb(0 0 0 / 0.6);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    font-size: clamp(9px, 2.6cqh, 12px);
    color: rgb(255 255 255 / 0.85);
    pointer-events: none;
}
.card.mine .who {
    background: rgb(var(--color-primary));
    color: #fff;
    font-weight: 700;
}
.card.suspense {
    z-index: 2;
}
.card.suspense .front {
    box-shadow:
        inset 0 0 0 2px #ffd54a,
        0 0 24px rgb(255 213 74 / 0.7);
}
.overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(8 8 12 / 0.55);
    pointer-events: none;
}
.overlay.soft {
    background: none;
}
.big {
    font-weight: 800;
    font-size: clamp(40px, 45cqh, 220px);
    color: #ffd54a;
    text-shadow: 0 0 30px rgb(255 213 74 / 0.6);
}
.banner {
    padding: clamp(6px, 2.5cqh, 16px) clamp(14px, 4cqw, 32px);
    border-radius: 14px;
    background: rgb(11 11 13 / 0.88);
    border: 2px solid rgb(255 255 255 / 0.2);
    font-weight: 800;
    font-size: clamp(14px, 7cqh, 34px);
    text-align: center;
}
.banner.win {
    color: #7bd88f;
    border-color: #7bd88f;
}
.banner.big {
    color: #8ff0d0;
    border-color: #8ff0d0;
    box-shadow: 0 0 32px rgb(47 191 154 / 0.5);
}
.banner.jackpot {
    color: #ffd54a;
    border-color: #ffd54a;
    box-shadow: 0 0 40px rgb(255 213 74 / 0.5);
}
.banner.none {
    color: rgb(255 255 255 / 0.75);
}
@media (prefers-reduced-motion: no-preference) {
    .clock.hurry {
        animation: throb 1s ease-in-out infinite;
    }
    .card.suspense .inner {
        animation: shake 0.45s ease-in-out infinite;
    }
    .card.jackpot.shown .back,
    .card.big.shown .back {
        animation: glow 1.2s ease-in-out infinite;
    }
    .card.big.shown.taken,
    .card.jackpot.shown.taken {
        z-index: 2;
        animation: jump 0.6s cubic-bezier(0.3, 1.6, 0.5, 1);
    }
    .confetti span {
        animation: spray 1.1s ease-out forwards;
    }
    @keyframes jump {
        40% {
            transform: scale(1.3) rotate(-4deg);
        }
    }
    @keyframes spray {
        from {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) rotate(calc(-1 * var(--angle)));
        }
        to {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-260%) rotate(calc(-1 * var(--angle))) scale(1.3);
        }
    }
    .big {
        animation: zoom 1s ease-out both;
    }
    .banner {
        animation: rise 0.45s cubic-bezier(0.3, 1.5, 0.5, 1) both;
    }
    @keyframes throb {
        50% {
            transform: scale(1.25);
        }
    }
    @keyframes shake {
        0%,
        100% {
            transform: rotate(0) scale(1.12);
        }
        25% {
            transform: rotate(-6deg) scale(1.12);
        }
        75% {
            transform: rotate(6deg) scale(1.12);
        }
    }
    @keyframes glow {
        50% {
            box-shadow: 0 0 26px var(--glow, rgb(255 213 74 / 0.85));
        }
    }
    @keyframes zoom {
        from {
            opacity: 0;
            transform: scale(2.2);
        }
        25% {
            opacity: 1;
            transform: scale(1);
        }
        to {
            opacity: 0.6;
            transform: scale(0.85);
        }
    }
    @keyframes rise {
        from {
            opacity: 0;
            transform: translateY(20px) scale(0.8);
        }
    }
}
@media (prefers-reduced-motion: reduce) {
    .inner {
        transition: none;
    }
}

/* Short players: the title goes to the side, two long rows of cards, no names */
@container (max-height: 180px) {
    .frame {
        flex-direction: row;
        flex-wrap: wrap;
    }
    .top {
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 0;
        width: 120px;
        height: 100%;
        flex-shrink: 0;
        box-sizing: border-box;
    }
    .status {
        white-space: normal;
        font-size: 11px;
        line-height: 1.2;
    }
    .mute,
    .who,
    .bar {
        display: none;
    }
    .stage {
        height: 100%;
    }
    .board {
        grid-template-columns: repeat(15, minmax(0, 1fr));
        grid-template-rows: repeat(2, minmax(0, 1fr));
        padding: 6px 8px 6px 0;
    }
    .emblem {
        font-size: 14px;
    }
}
/* Narrow: six columns */
@container (max-width: 520px) and (min-height: 181px) {
    .board {
        grid-template-columns: repeat(6, minmax(0, 1fr));
        grid-template-rows: repeat(5, minmax(0, 1fr));
    }
}
</style>
