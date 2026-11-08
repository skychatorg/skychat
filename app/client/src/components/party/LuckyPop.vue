<script setup>
import { playCasinoSound } from '@/lib/casinoSounds';
import { useNow } from '@/composables/useNow';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { formatMoney } from '../../../../api/money.ts';
import { computed, ref, watch } from 'vue';

const SIZE_LABELS = { xs: 'xs', md: 'md', lg: 'lg', golden: 'golden', pinata: 'piñata', hotair: 'hot air', peek: 'peek' };
const MALUS_WORDS = { xs: 'mild', md: 'medium', lg: 'nasty' };
// A popped balloon has room for a word or two: the feed has the full text
const MALUS_TAGS = {
    wizz: 'wizzed',
    scramble: 'scrambled',
    butterfingers: 'butterfingers',
    sandale: '👞 sandaled',
    grounded: 'grounded',
    storm: 'wizz storm',
    'grounded-sandale': 'grounded + 👞',
};
const tag = (result) =>
    result.malus
        ? MALUS_TAGS[result.malus]
        : result.kind === 'lose'
        ? result.amount
            ? formatMoney(result.amount)
            : 'face pop'
        : result.kind === 'jackpot' || result.kind === 'pinata'
        ? `+${formatMoney(result.amount)}`
        : result.kind === 'peek'
        ? 'peeked'
        : result.label;
// What a peek showed you, on the balloon itself
const peekTag = ({ kind, amount }) =>
    ({ money: formatMoney(amount), jackpot: formatMoney(amount), empty: 'empty', malus: 'malus', lose: 'face pop' })[kind];

const app = useAppStore();
const client = useClientStore();
const now = useNow();

const sky = computed(() => client.state.luckyPop);
const isGuest = computed(() => !client.state.user.id);
const secondsLeft = computed(() => Math.max(0, Math.ceil((sky.value.deadline - now.value) / 1000)));
const cooldown = computed(() => Math.max(0, Math.ceil((sky.value.you.nextPopAt - now.value) / 1000)));
const left = computed(() => sky.value.balloons.filter((b) => !b.popped).length);

// The round's time always shows, your own limit after it
const status = computed(() => {
    const you = isGuest.value
        ? 'log in to pop'
        : sky.value.you.grounded
        ? 'grounded'
        : cooldown.value
        ? `next pop in ${cooldown.value}s`
        : null;
    return [`${secondsLeft.value}s left`, `${left.value} balloons`, you].filter(Boolean).join(' · ');
});

const oddsLine = (size, { chance, kind, amount }) => {
    const what = {
        money: formatMoney(amount),
        jackpot: `jackpot ${formatMoney(amount)}`,
        empty: 'nothing',
        lose: `lose ${formatMoney(amount)} more`,
        malus: `${MALUS_WORDS[size]} malus`,
    }[kind];
    return { text: `${chance}%: ${what}`, kind };
};

// Two rows of six spots, nudged so the sky doesn't look like a grid
const spot = (id) => ({
    // Kept off the edges, so the biggest balloons are never cut
    left: `${10 + (id % 6) * 16 + ((id * 7) % 5) - 2}%`,
    top: `${id < 6 ? 34 : 72}%`,
    delay: `-${(id * 0.37) % 3}s`,
});

// The special balloons explain themselves instead of listing prizes
const rules = (size, price) =>
    ({
        pinata: [
            `${price} a hit, into the pot`,
            `1 hit in ${sky.value.pinataOdds} bursts it`,
            'the burster takes it all',
            'no burst: hits paid back',
        ],
        hotair: [
            `its prize doubles every ${sky.value.hotAir.doubleMs / 1000} s`,
            'it may burst any second',
            'first to pop takes the prize',
        ],
        peek: ['no prize inside', 'shows you what another', 'balloon holds, only you'],
    })[size]?.map((text) => ({ text, kind: 'muted' }));

// The hot air balloon's prize right now, and how much it has inflated
const multiplier = computed(() => 2 ** (Math.max(0, now.value - sky.value.hotAir.startedAt) / sky.value.hotAir.doubleMs));

const balloons = computed(() =>
    sky.value.balloons.map((balloon) => {
        const price = sky.value.sizes[balloon.size].price;
        const hotAirPrize = formatMoney(Math.floor(price * multiplier.value));
        return {
            ...balloon,
            price: formatMoney(price),
            // Under the balloon: what is at stake
            label:
                balloon.size === 'pinata'
                    ? `${formatMoney(balloon.pot)} pot`
                    : balloon.size === 'hotair'
                    ? hotAirPrize
                    : formatMoney(price),
            aria:
                balloon.size === 'pinata'
                    ? `Hit the piñata for ${formatMoney(price)}, pot ${formatMoney(balloon.pot)}`
                    : balloon.size === 'hotair'
                    ? `Pop the hot air balloon for ${formatMoney(price)}, prize ${hotAirPrize}`
                    : `Pop ${balloon.size === 'golden' ? 'the golden' : 'an ' + SIZE_LABELS[balloon.size]} balloon for ${formatMoney(
                          price,
                      )}${balloon.peek ? `, you peeked: ${peekTag(balloon.peek)}` : ''}`,
            odds:
                rules(balloon.size, formatMoney(price)) ??
                sky.value.sizes[balloon.size].prizes.map((prize) => oddsLine(balloon.size, prize)),
            grow: balloon.size === 'hotair' ? Math.min(1.8, 1 + Math.log2(multiplier.value) * 0.2) : 1,
            spot: spot(balloon.id),
            mine: balloon.result?.username === client.state.user.username,
        };
    }),
);
const canPop = computed(() => !isGuest.value && !sky.value.you.grounded && !cooldown.value);

// Phones have no hover: the first tap shows the odds, the second pops
const shown = ref(null);
const hovered = ref(null);
const active = computed(() => balloons.value.find((b) => !b.popped && b.id === (hovered.value ?? shown.value)) ?? null);
let touch = false;
const tap = (balloon) => {
    // Not poppable right now: still a way to read the odds on a phone
    if ((touch && shown.value !== balloon.id) || !canPop.value) {
        shown.value = balloon.id;
        return;
    }
    shown.value = null;
    client.sendMessage(`/party pop ${balloon.id}`);
};

const feed = computed(() =>
    sky.value.balloons
        .filter((b) => b.result)
        .sort((a, b) => b.result.order - a.result.order)
        .map((b) => ({ ...b.result, size: b.size })),
);

// Every hit on the piñata is heard by the whole room
watch(
    () => sky.value.balloons.reduce((sum, b) => sum + b.hits, 0),
    (hits, before) => app.casinoSound && hits > before && playCasinoSound('punch'),
);

// A pop sound for every balloon that bursts, and how it went for yours
watch(
    () => feed.value.length,
    (count, before) => {
        if (!app.casinoSound || count <= before) {
            return;
        }
        playCasinoSound('pop');
        const latest = feed.value[0];
        // A jackpot or a burst piñata is a moment for the whole room
        if (latest.kind === 'jackpot' || latest.kind === 'pinata') {
            playCasinoSound('blackjack', 150);
        } else if (latest.username === client.state.user.username) {
            playCasinoSound(latest.kind === 'money' ? 'win' : ['empty', 'peek'].includes(latest.kind) ? 'push' : 'lose', 150);
        }
    },
);
</script>

<template>
    <div class="lucky">
        <div class="frame">
            <div class="top">
                <span class="title">Lucky Pop</span>
                <span class="status">{{ status }}</span>
                <button
                    class="mute"
                    :title="app.casinoSound ? 'Mute the game' : 'Turn game sounds on'"
                    :aria-pressed="!app.casinoSound"
                    @click="app.toggleCasinoSound()"
                >
                    <fa :icon="app.casinoSound ? 'volume-high' : 'volume-xmark'" />
                </button>
            </div>
            <div class="body">
                <div class="sky">
                    <template v-for="balloon in balloons" :key="balloon.id">
                        <button
                            v-if="!balloon.popped"
                            class="balloon"
                            :class="[
                                balloon.size,
                                {
                                    shown: shown === balloon.id,
                                    high: balloon.id < 6,
                                    west: balloon.id % 6 < 2,
                                    east: balloon.id % 6 > 3,
                                },
                            ]"
                            :style="{
                                left: balloon.spot.left,
                                top: balloon.spot.top,
                                animationDelay: balloon.spot.delay,
                                '--i': balloon.id,
                                '--grow': balloon.grow,
                            }"
                            :aria-disabled="!canPop"
                            :aria-label="balloon.aria"
                            :aria-describedby="`odds-${balloon.id}`"
                            @pointerdown="touch = $event.pointerType === 'touch'"
                            @pointerenter="hovered = balloon.id"
                            @pointerleave="hovered = null"
                            @focus="hovered = balloon.id"
                            @blur="hovered = null"
                            @click="tap(balloon)"
                        >
                            <!-- Keyed on the hits, so it shakes again at every hit -->
                            <span v-if="balloon.size === 'pinata'" :key="balloon.hits" class="pinata-body" aria-hidden="true">🪅</span>
                            <svg v-else viewBox="0 0 40 56" aria-hidden="true">
                                <ellipse cx="20" cy="20" rx="17" ry="19" class="skin" />
                                <ellipse cx="13" cy="12" rx="4" ry="6" fill="#fff" opacity=".3" />
                                <path d="M17 39l3 3 3-3z" class="skin" />
                                <path d="M20 42c-3 4 3 7 0 13" stroke="rgba(255,255,255,.4)" stroke-width="1" fill="none" />
                                <text v-if="balloon.size === 'peek'" x="20" y="27" text-anchor="middle" font-size="20" fill="#fff">?</text>
                                <rect v-if="balloon.size === 'hotair'" x="15" y="48" width="10" height="7" rx="1.5" fill="#a0703c" />
                            </svg>
                            <span v-if="balloon.peek" class="peeked" :class="balloon.peek.kind">👁 {{ peekTag(balloon.peek) }}</span>
                            <span class="price">{{ balloon.label }}</span>
                            <span :id="`odds-${balloon.id}`" class="odds" role="tooltip">
                                <span class="odds-title"
                                    >{{ balloon.size === 'golden' ? 'golden, no malus' : SIZE_LABELS[balloon.size] }} ·
                                    {{ balloon.label }}</span
                                >
                                <span v-for="(line, i) in balloon.odds" :key="i" :class="line.kind">{{ line.text }}</span>
                            </span>
                        </button>
                        <span
                            v-else
                            class="result"
                            :class="[balloon.result?.kind, { mine: balloon.mine }]"
                            :style="{ left: balloon.spot.left, top: balloon.spot.top, '--i': balloon.id }"
                        >
                            <span v-if="balloon.result?.username" class="who">{{ balloon.result.username }}</span>
                            {{ tag(balloon.result) }}
                        </span>
                    </template>
                </div>
                <ol class="feed" aria-label="What popped" aria-live="polite">
                    <li v-for="entry in feed" :key="entry.order">
                        <b v-if="entry.username">{{ entry.username }}</b>
                        <span class="muted">{{ entry.size === 'golden' ? 'golden' : SIZE_LABELS[entry.size] }}:</span>
                        <span :class="entry.kind">{{ entry.label }}</span>
                    </li>
                    <li v-if="!feed.length" class="muted">Nothing popped yet.</li>
                </ol>
            </div>
            <!-- Short players have no room for the odds box: one line along the bottom instead -->
            <div v-if="active" class="odds-line" aria-hidden="true">
                <span class="muted">{{ SIZE_LABELS[active.size] }} {{ active.label }}</span>
                <span v-for="(line, i) in active.odds" :key="i" :class="line.kind">{{ line.text }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.lucky {
    container-type: size;
    width: 100%;
    height: 100%;
}
/* Inside the container, so the size rules below can restyle it */
.frame {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: linear-gradient(#1d2740, #12131a 85%);
    color: #f4f4ff;
    /* Balloons scale with the player height */
    --b: clamp(22px, min(13cqh, 6.5cqw), 96px);
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
    color: rgb(255 255 255 / 0.7);
    font-family: ui-monospace, monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
.body {
    flex: 1;
    min-height: 0;
    display: flex;
}
.sky {
    position: relative;
    flex: 1;
    min-width: 0;
}
.balloon {
    position: absolute;
    width: var(--w);
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    --w: var(--b);
    --skin: #779be9;
}
.balloon.md {
    --w: calc(var(--b) * 1.35);
    --skin: #f0a63a;
}
.balloon.lg {
    --w: calc(var(--b) * 1.75);
    --skin: #e5527a;
}
.balloon.golden {
    --w: calc(var(--b) * 1.35);
    --skin: #ffd54a;
}
.balloon.pinata {
    --w: calc(var(--b) * 1.5);
}
/* Inflates as its prize grows */
.balloon.hotair {
    --w: calc(var(--b) * 1.2 * var(--grow));
    --skin: #ff7a3d;
    transition: width 1s linear;
}
.balloon.peek {
    --w: calc(var(--b) * 1.2);
    --skin: #9b7bff;
}
.peeked {
    position: absolute;
    top: 20%;
    padding: 1px 5px;
    border-radius: 6px;
    background: rgb(0 0 0 / 0.75);
    font-size: clamp(10px, 3cqh, 13px);
    font-weight: 700;
    white-space: nowrap;
}
.pinata-body {
    font-size: calc(var(--w) * 0.85);
    line-height: 1.1;
    filter: drop-shadow(0 4px 8px rgb(0 0 0 / 0.35));
}
.balloon svg {
    width: 100%;
    filter: drop-shadow(0 4px 8px rgb(0 0 0 / 0.35));
}
.skin {
    fill: var(--skin);
}
.balloon.golden .skin {
    stroke: #fff6c4;
    stroke-width: 1.5;
}
.balloon[aria-disabled='true'] {
    cursor: not-allowed;
}
.balloon[aria-disabled='true'] svg {
    opacity: 0.5;
}
.balloon:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
    border-radius: 50%;
}
.price {
    margin-top: -4px;
    font-size: clamp(10px, 3cqh, 13px);
    font-weight: 600;
    text-shadow: 0 1px 2px #000;
}
.odds {
    display: none;
    position: absolute;
    left: 50%;
    bottom: 100%;
    transform: translateX(-50%);
    margin-bottom: 4px;
    z-index: 5;
    flex-direction: column;
    padding: 7px 9px;
    border-radius: 8px;
    background: #0b0b0d;
    border: 1px solid rgb(255 255 255 / 0.2);
    font:
        500 12px ui-monospace,
        monospace;
    text-align: left;
    white-space: nowrap;
}
/* The two outer columns on each side open their odds inward, so they stay inside the player */
.balloon.west .odds {
    left: 0;
    transform: none;
}
.balloon.east .odds {
    left: auto;
    right: 0;
    transform: none;
}
/* The top row opens its odds below, so they stay inside the player */
.balloon.high .odds {
    bottom: auto;
    top: 100%;
    margin: 4px 0 0;
}
.balloon:hover .odds,
.balloon:focus-visible .odds,
.balloon.shown .odds {
    display: flex;
}
.balloon:hover,
.balloon.shown {
    z-index: 4;
}
.odds-title {
    color: rgb(255 255 255 / 0.55);
    margin-bottom: 2px;
}
.money {
    color: #7bd88f;
}
.jackpot,
.pinata {
    color: #f0c46c;
    font-weight: 700;
}
.empty,
.muted {
    color: rgb(255 255 255 / 0.55);
}
.malus,
.lose {
    color: #ff8fa3;
}
.result {
    position: absolute;
    transform: translate(-50%, -50%);
    /* One spot wide, so neighbours never overlap */
    max-width: 15%;
    overflow-wrap: anywhere;
    padding: 3px 7px;
    border-radius: 8px;
    background: rgb(0 0 0 / 0.55);
    font-size: clamp(10px, 3cqh, 13px);
    text-align: center;
    line-height: 1.25;
    animation: burst 0.3s ease-out;
}
.result.mine {
    outline: 1px solid rgb(255 255 255 / 0.5);
}
.who {
    display: block;
    color: rgb(255 255 255 / 0.6);
    font-size: 0.85em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.feed {
    display: none;
    width: 230px;
    margin: 0;
    padding: 6px 14px 10px;
    list-style: none;
    overflow-y: auto;
    border-left: 1px solid rgb(255 255 255 / 0.08);
    font-size: 13px;
    line-height: 1.4;
}
.feed li {
    display: flex;
    flex-wrap: wrap;
    gap: 0 5px;
}
.feed li + li {
    margin-top: 6px;
}
@container (min-width: 760px) and (min-height: 220px) {
    .feed {
        display: block;
    }
}
@media (prefers-reduced-motion: no-preference) {
    .balloon {
        animation: bob 3.2s ease-in-out infinite;
    }
    .balloon:hover,
    .balloon.shown {
        animation-play-state: paused;
    }
    @keyframes bob {
        50% {
            transform: translate(-50%, calc(-50% - 6px));
        }
    }
    .pinata-body {
        animation: whack 0.35s ease-out;
    }
    @keyframes whack {
        30% {
            transform: rotate(-18deg) scale(1.1);
        }
        60% {
            transform: rotate(10deg);
        }
    }
    @keyframes burst {
        from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.6);
        }
    }
}

/* Short players: one row of balloons, labels without names */
@container (max-height: 180px) {
    .frame {
        --b: clamp(14px, min(26cqh, 5cqw), 34px);
        flex-direction: row;
    }
    .top {
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 0;
        width: 110px;
        flex-shrink: 0;
    }
    .mute {
        display: none;
    }
    .balloon,
    .result {
        top: 50% !important;
        left: calc((var(--i) + 0.5) * 100% / 12) !important;
    }
    .who {
        display: none;
    }
    .result {
        max-width: 8%;
        padding: 2px 3px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
}

.odds-line {
    display: none;
}
@container (max-height: 260px) {
    .odds {
        display: none !important;
    }
    .odds-line {
        display: flex;
        flex-wrap: wrap;
        gap: 0 10px;
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 6;
        padding: 3px 10px;
        background: rgb(11 11 13 / 0.92);
        font:
            500 12px ui-monospace,
            monospace;
    }
}
</style>
