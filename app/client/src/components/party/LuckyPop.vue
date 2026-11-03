<script setup>
import { playCasinoSound } from '@/lib/casinoSounds';
import { useNow } from '@/composables/useNow';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { formatMoney } from '../../../../api/money.ts';
import { computed, ref, watch } from 'vue';

const SIZE_LABELS = { xs: 'xs', md: 'md', lg: 'lg', golden: 'golden' };
const MALUS_WORDS = { xs: 'mild', md: 'medium', lg: 'nasty' };

const app = useAppStore();
const client = useClientStore();
const now = useNow();

const sky = computed(() => client.state.luckyPop);
const isGuest = computed(() => !client.state.user.id);
const secondsLeft = computed(() => Math.max(0, Math.ceil((sky.value.deadline - now.value) / 1000)));
const cooldown = computed(() => Math.max(0, Math.ceil((sky.value.you.nextPopAt - now.value) / 1000)));
const left = computed(() => sky.value.balloons.filter((b) => !b.popped).length);

const status = computed(() => {
    if (isGuest.value) {
        return 'Log in to pop';
    }
    if (sky.value.you.grounded) {
        return 'Grounded until the next round';
    }
    if (cooldown.value) {
        return `Next pop in ${cooldown.value}s`;
    }
    return `${left.value} left · ${secondsLeft.value}s`;
});

const oddsLine = (size, { chance, kind, amount }) => {
    const what = {
        money: formatMoney(amount),
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

const balloons = computed(() =>
    sky.value.balloons.map((balloon) => ({
        ...balloon,
        price: formatMoney(sky.value.sizes[balloon.size].price),
        odds: sky.value.sizes[balloon.size].prizes.map((prize) => oddsLine(balloon.size, prize)),
        spot: spot(balloon.id),
        mine: balloon.result?.username === client.state.user.username,
    })),
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

// A pop sound for every balloon that bursts, and how it went for yours
watch(
    () => feed.value.length,
    (count, before) => {
        if (!app.casinoSound || count <= before) {
            return;
        }
        playCasinoSound('pop');
        const latest = feed.value[0];
        if (latest.username === client.state.user.username) {
            playCasinoSound(latest.kind === 'money' ? 'win' : latest.kind === 'empty' ? 'push' : 'lose', 150);
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
                            :class="[balloon.size, { shown: shown === balloon.id, high: balloon.id < 6 }]"
                            :style="{
                                left: balloon.spot.left,
                                top: balloon.spot.top,
                                animationDelay: balloon.spot.delay,
                                '--i': balloon.id,
                            }"
                            :aria-disabled="!canPop"
                            :aria-label="`Pop ${balloon.size === 'golden' ? 'the golden' : 'an ' + SIZE_LABELS[balloon.size]} balloon for ${
                                balloon.price
                            }`"
                            :aria-describedby="`odds-${balloon.id}`"
                            @pointerdown="touch = $event.pointerType === 'touch'"
                            @pointerenter="hovered = balloon.id"
                            @pointerleave="hovered = null"
                            @focus="hovered = balloon.id"
                            @blur="hovered = null"
                            @click="tap(balloon)"
                        >
                            <svg viewBox="0 0 40 56" aria-hidden="true">
                                <ellipse cx="20" cy="20" rx="17" ry="19" class="skin" />
                                <ellipse cx="13" cy="12" rx="4" ry="6" fill="#fff" opacity=".3" />
                                <path d="M17 39l3 3 3-3z" class="skin" />
                                <path d="M20 42c-3 4 3 7 0 13" stroke="rgba(255,255,255,.4)" stroke-width="1" fill="none" />
                            </svg>
                            <span class="price">{{ balloon.price }}</span>
                            <span :id="`odds-${balloon.id}`" class="odds" role="tooltip">
                                <span class="odds-title"
                                    >{{ balloon.size === 'golden' ? 'golden, no malus' : SIZE_LABELS[balloon.size] }} ·
                                    {{ balloon.price }}</span
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
                            <span class="who">{{ balloon.result?.username }}</span>
                            {{ balloon.result?.label }}
                        </span>
                    </template>
                </div>
                <ol class="feed" aria-label="What popped" aria-live="polite">
                    <li v-for="entry in feed" :key="entry.order">
                        <b>{{ entry.username }}</b>
                        <span class="muted">{{ entry.size === 'golden' ? 'golden' : SIZE_LABELS[entry.size] }}:</span>
                        <span :class="entry.kind">{{ entry.label }}</span>
                    </li>
                    <li v-if="!feed.length" class="muted">Nothing popped yet.</li>
                </ol>
            </div>
            <!-- Short players have no room for the odds box: one line along the bottom instead -->
            <div v-if="active" class="odds-line" aria-hidden="true">
                <span class="muted">{{ active.size === 'golden' ? 'golden' : SIZE_LABELS[active.size] }} {{ active.price }}</span>
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
    max-width: 30%;
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
