<script setup>
import { computed, reactive, ref, watch } from 'vue';
import UserTitle from '@/components/user/UserTitle.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useNow } from '@/composables/useNow';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import { formatMoney } from '../../../../api/money.ts';
import { COLORS, DEFAULT_COLOR, SHOP, TITLE_MAX_LENGTH } from '../../../../api/shop.ts';
import { avatarStyle, nameStyle } from '@/lib/cosmetics';

const ICONS = { color: 'palette', effect: 'wand-magic-sparkles', frame: 'image', title: 'tag', shield: 'shield-halved' };
const TABS = { color: 'Colors', effect: 'Names', frame: 'Frames', title: 'Titles', shield: 'Shield' };

const app = useAppStore();
const client = useClientStore();
const now = useNow(30_000);

const user = computed(() => client.state.user);
const worn = computed(() => user.value.data.plugins.custom ?? {});
const loggedIn = computed(() => user.value.right >= 0);

const tab = ref('color');
const item = computed(() => SHOP[tab.value]);

const until = (slot) => worn.value[`${slot}Until`] ?? 0;
const renting = (slot) => until(slot) > now.value;
const colorHex = (id) => COLORS.find((color) => String(color.id) === id)?.value;

/** What each item shows as picked: what is worn while it is rented, else what was clicked to try it on */
const picked = reactive({});
const optionOf = (slot) => {
    const value = worn.value[slot];
    return slot === 'color' ? String(COLORS.find((color) => color.value === value)?.id) : value;
};
const selected = (slot) => (renting(slot) ? optionOf(slot) : picked[slot]);

/** The title being written, starting from the one worn. Counted in characters like the server, not UTF-16 units */
const titleDraft = ref('');
const titleLength = computed(() => [...titleDraft.value.trim()].length);
const saveTitle = () => client.sendMessage(`/custom use title ${titleDraft.value.trim()}`);

/** The duration picked for each item, the shortest by default */
const durations = reactive({});
const durationOf = (slot) => durations[slot] ?? Object.keys(SHOP[slot].prices)[0];

watch(
    () => app.modals.shop,
    (open) => {
        if (open) {
            Object.keys(picked).forEach((slot) => delete picked[slot]);
            titleDraft.value = worn.value.title ?? '';
        }
    },
);

/** Clicking an option wears it right away while the item is rented, and only tries it on otherwise */
const choose = (slot, option) => {
    if (renting(slot)) {
        client.sendMessage(`/custom use ${slot}:${option}`);
    } else {
        picked[slot] = picked[slot] === option ? undefined : option;
    }
};

/** You with what is worn, and what is being tried on over it */
const preview = computed(() => {
    const custom = { ...worn.value };
    for (const [slot, option] of Object.entries(picked)) {
        if (option && !renting(slot)) {
            custom[slot] = slot === 'color' ? colorHex(option) : option;
        }
    }
    if (titleDraft.value.trim()) {
        custom.title = titleDraft.value.trim();
    }
    return { username: user.value.username, data: { plugins: { ...user.value.data.plugins, custom } } };
});
/** The preview, wearing this option instead */
const wearing = (slot, option) => ({ data: { plugins: { custom: { ...preview.value.data.plugins.custom, [slot]: option } } } });

const timeLeft = (slot) => {
    const minutes = Math.max(0, Math.floor((until(slot) - now.value) / 60_000));
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor(minutes / 60) % 24;
    if (days > 0) return `${days}d ${hours}h left`;
    return hours > 0 ? `${hours}h ${minutes % 60}m left` : `${minutes}m left`;
};

/** What is worn for an item, in words */
const wornLabel = (slot) => {
    const value = worn.value[slot];
    if (slot === 'title') return value ? `“${value}”` : 'Title taken off';
    if (slot === 'shield') return 'Shield up';
    if (!value || value === DEFAULT_COLOR) return `${SHOP[slot].name} taken off`;
    const id = slot === 'color' ? optionOf(slot) : value;
    return `${SHOP[slot].name}: ${SHOP[slot].options.find((option) => option.id === id)?.name ?? value}`;
};
const rentals = computed(() => Object.keys(SHOP).filter((slot) => renting(slot)));
const canTakeOff = (slot) => renting(slot) && worn.value[slot] && worn.value[slot] !== DEFAULT_COLOR;

const price = computed(() => item.value.prices[durationOf(tab.value)]);
/** Why the current item can't be rented, shown on the checkout button */
const blocker = computed(() => {
    const slot = tab.value;
    if (!loggedIn.value) return 'Log in to shop';
    if (!renting(slot) && item.value.options && !picked[slot]) return 'Pick one first';
    if (slot === 'title' && !titleLength.value) return 'Write it first';
    if (slot === 'title' && titleLength.value > TITLE_MAX_LENGTH) return 'Too long';
    if (user.value.money < price.value) return `${formatMoney(price.value - user.value.money)} short`;
    return null;
});
/** What the checkout bar is about to rent */
const summary = computed(() => {
    const slot = tab.value;
    if (slot === 'title') return titleDraft.value.trim() ? `Title “${titleDraft.value.trim()}”` : 'Title';
    if (slot === 'shield') return 'Shield';
    const option = item.value.options.find((o) => o.id === selected(slot));
    return option ? `${item.value.name}: ${option.name}` : item.value.name;
});

/** A first tap asks to confirm, so a stray tap while scrolling costs nothing */
const confirming = ref(false);
let confirmTimer = null;
watch([tab, () => durationOf(tab.value)], () => (confirming.value = false));
const checkout = () => {
    clearTimeout(confirmTimer);
    if (!confirming.value) {
        confirming.value = true;
        confirmTimer = setTimeout(() => (confirming.value = false), 3000);
        return;
    }
    confirming.value = false;
    const slot = tab.value;
    const duration = durationOf(slot);
    if (slot === 'title') {
        client.sendMessage(`/custom buy title ${duration} ${titleDraft.value.trim()}`);
        return;
    }
    const option = selected(slot);
    client.sendMessage(`/custom buy ${option ? `${slot}:${option}` : slot} ${duration}`);
};
</script>

<template>
    <ModalTemplate id="shop" title="Shop" variant="wide">
        <div class="shop">
            <!-- You, live, the way others will see you -->
            <aside class="you">
                <div class="balance">
                    <span class="label">Balance</span>
                    <span class="money">{{ formatMoney(user.money) }}</span>
                </div>

                <span class="label">How others see you</span>
                <div class="sample">
                    <div class="flex items-center gap-2.5">
                        <div class="avatar w-8 h-8 rounded border-2" v-bind="avatarStyle(preview)">
                            <img :src="user.data.plugins.avatar" alt="" />
                        </div>
                        <div class="min-w-0 flex items-center gap-1.5">
                            <span class="text-sm font-semibold truncate" v-bind="nameStyle(preview)">{{ user.username }}</span>
                            <UserTitle :user="preview" />
                        </div>
                    </div>
                </div>
                <div class="sample hidden md:block">
                    <div class="flex gap-3">
                        <div class="avatar w-7 h-7 mt-0.5 rounded border-2" v-bind="avatarStyle(preview)">
                            <img :src="user.data.plugins.avatar" alt="" />
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-baseline gap-2">
                                <span class="font-semibold truncate" v-bind="nameStyle(preview)">{{ user.username }}</span>
                                <UserTitle :user="preview" />
                                <span class="font-mono text-xs text-white/30">now</span>
                            </div>
                            <p class="text-sm">gg everyone 🎉</p>
                        </div>
                    </div>
                </div>
                <div class="sample hidden md:flex flex-col items-center gap-2 py-4">
                    <div class="avatar w-16 h-16 rounded-xl border-4" v-bind="avatarStyle(preview)">
                        <img :src="user.data.plugins.avatar" alt="" />
                    </div>
                    <span class="text-lg font-semibold" v-bind="nameStyle(preview)">{{ user.username }}</span>
                    <UserTitle :user="preview" />
                </div>
            </aside>

            <!-- Below the store on phones, so picking comes first -->
            <aside class="mine">
                <span class="label">Your rentals</span>
                <ul v-if="rentals.length" class="rentals">
                    <li v-for="slot in rentals" :key="slot">
                        <fa :icon="ICONS[slot]" class="text-white/40 w-4" />
                        <div class="grow min-w-0">
                            <div class="text-sm truncate">{{ wornLabel(slot) }}</div>
                            <div class="font-mono text-xs text-emerald-400">{{ timeLeft(slot) }}</div>
                        </div>
                        <button v-if="canTakeOff(slot)" class="take-off" @click="client.sendMessage(`/custom off ${slot}`)">
                            Take off
                        </button>
                    </li>
                </ul>
                <p v-else class="text-sm text-white/40">Nothing yet. Everything here is rented, and switching is free while it lasts.</p>
            </aside>

            <section class="store">
                <nav class="tabs" role="tablist">
                    <button
                        v-for="(name, slot) in TABS"
                        :key="slot"
                        role="tab"
                        class="tab"
                        :class="{ on: tab === slot }"
                        :aria-selected="tab === slot"
                        @click="tab = slot"
                    >
                        <fa :icon="ICONS[slot]" />
                        <span>{{ name }}</span>
                        <span v-if="renting(slot)" class="dot" title="Rented" />
                    </button>
                </nav>

                <header class="head">
                    <div>
                        <h3 class="text-xl font-bold">{{ item.name }}</h3>
                        <p class="text-sm text-white/55">
                            {{ item.pitch }}<template v-if="renting(tab) && item.options"> Switch for free while it lasts.</template>
                        </p>
                    </div>
                    <span v-if="renting(tab)" class="font-mono text-sm text-emerald-400 shrink-0">{{ timeLeft(tab) }}</span>
                </header>

                <div class="options">
                    <div v-if="tab === 'color'" class="swatches">
                        <button
                            v-for="option in item.options"
                            :key="option.id"
                            class="swatch"
                            :class="{ on: selected('color') === option.id }"
                            :style="{ backgroundColor: colorHex(option.id) }"
                            :title="option.name"
                            :aria-label="option.name"
                            :aria-pressed="selected('color') === option.id"
                            @click="choose('color', option.id)"
                        />
                    </div>

                    <div v-else-if="tab === 'effect' || tab === 'frame'" class="cards">
                        <button
                            v-for="option in item.options"
                            :key="option.id"
                            class="card"
                            :class="{ on: selected(tab) === option.id }"
                            :aria-pressed="selected(tab) === option.id"
                            @click="choose(tab, option.id)"
                        >
                            <span
                                v-if="tab === 'effect'"
                                class="text-2xl font-bold truncate max-w-full"
                                v-bind="nameStyle(wearing('effect', option.id))"
                                >{{ user.username }}</span
                            >
                            <span v-else class="avatar w-14 h-14 rounded-lg border-[3px]" v-bind="avatarStyle(wearing('frame', option.id))">
                                <img :src="user.data.plugins.avatar" alt="" />
                            </span>
                            <span class="text-sm text-white/70">{{ option.name }}</span>
                        </button>
                    </div>

                    <form
                        v-else-if="tab === 'title'"
                        class="flex flex-col gap-2 max-w-md"
                        @submit.prevent="renting('title') && saveTitle()"
                    >
                        <div class="flex gap-2">
                            <input
                                v-model="titleDraft"
                                class="form-control grow min-w-0 text-lg"
                                placeholder="Queen of Crash"
                                aria-label="Your title"
                            />
                            <button
                                v-if="renting('title')"
                                class="form-control shrink-0 disabled:opacity-40"
                                :disabled="!titleLength || titleLength > TITLE_MAX_LENGTH || titleDraft.trim() === worn.title"
                            >
                                Save
                            </button>
                        </div>
                        <span class="font-mono text-xs" :class="titleLength > TITLE_MAX_LENGTH ? 'text-danger' : 'text-white/40'">
                            {{ titleLength }}/{{ TITLE_MAX_LENGTH }}
                        </span>
                    </form>

                    <div v-else class="shield">
                        <fa icon="shield-halved" class="text-6xl" :class="renting('shield') ? 'text-emerald-400' : 'text-white/20'" />
                        <p class="text-white/70">{{ renting('shield') ? 'Your shield is up.' : 'No shield up.' }}</p>
                    </div>
                </div>

                <!-- Checkout -->
                <footer class="checkout">
                    <span class="grow min-w-0 truncate font-semibold">{{ summary }}</span>
                    <div class="segmented" role="radiogroup" aria-label="Duration">
                        <button
                            v-for="(cost, duration) in item.prices"
                            :key="duration"
                            role="radio"
                            :aria-checked="durationOf(tab) === duration"
                            :class="{ on: durationOf(tab) === duration }"
                            @click="durations[tab] = duration"
                        >
                            1 {{ duration }} · {{ formatMoney(cost) }}
                        </button>
                    </div>
                    <button class="rent" :class="{ confirm: confirming }" :disabled="!!blocker" @click="checkout">
                        <template v-if="blocker">{{ blocker }}</template>
                        <template v-else-if="confirming">Confirm {{ formatMoney(price) }}</template>
                        <template v-else>{{ renting(tab) ? 'Extend' : 'Rent' }} · {{ formatMoney(price) }}</template>
                    </button>
                </footer>
            </section>
        </div>
    </ModalTemplate>
</template>

<style scoped>
.shop {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    grid-template-areas:
        'you store'
        'mine store';
    gap: 16px 24px;
    min-height: 100%;
    padding-bottom: 16px;
}
.label {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgb(255 255 255 / 0.4);
}
.you,
.mine {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.balance {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgb(240 196 108 / 0.08);
    border: 1px solid rgb(240 196 108 / 0.25);
}
.money {
    font-family: ui-monospace, monospace;
    font-size: 20px;
    color: #f0c46c;
}
.sample {
    padding: 10px 12px;
    border-radius: 12px;
    background: rgb(255 255 255 / 0.03);
    border: 1px solid rgb(255 255 255 / 0.08);
}
.avatar {
    display: block;
    flex-shrink: 0;
    overflow: hidden;
    background: black;
    border-style: solid;
}
.avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.rentals {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.rentals li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgb(255 255 255 / 0.03);
}
.take-off {
    font-size: 12px;
    color: rgb(255 255 255 / 0.5);
    text-decoration: underline;
}
.take-off:hover {
    color: white;
}
.you {
    grid-area: you;
}
.mine {
    grid-area: mine;
    align-self: start;
}
.store {
    grid-area: store;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
}
.tabs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
}
.tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 10px;
    white-space: nowrap;
    color: rgb(255 255 255 / 0.6);
    background: rgb(255 255 255 / 0.03);
    border: 1px solid rgb(255 255 255 / 0.08);
    transition:
        color 0.15s,
        background 0.15s;
}
.tab:hover {
    color: white;
}
.tab.on {
    color: white;
    background: rgb(var(--color-primary) / 0.15);
    border-color: rgb(var(--color-primary) / 0.5);
}
.dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgb(52 211 153);
}
.head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
}
.options {
    flex-grow: 1;
}
.swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 8px;
}
.swatch {
    aspect-ratio: 1;
    border-radius: 8px;
    outline: 2px solid transparent;
    outline-offset: 3px;
    transition:
        transform 0.1s,
        outline-color 0.1s;
}
.swatch:hover {
    transform: scale(1.1);
}
.swatch.on,
.swatch:focus-visible {
    outline-color: white;
}
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 10px;
}
.card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 120px;
    padding: 16px;
    border-radius: 14px;
    background: rgb(255 255 255 / 0.04);
    border: 2px solid rgb(255 255 255 / 0.08);
    transition:
        border-color 0.15s,
        background 0.15s;
}
.card:hover {
    background: rgb(255 255 255 / 0.07);
    border-color: rgb(255 255 255 / 0.25);
}
.card.on {
    border-color: white;
}
.shield {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 0;
}
.checkout {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: 14px;
    background: rgb(20 20 32 / 0.9);
    border: 1px solid rgb(255 255 255 / 0.1);
    backdrop-filter: blur(12px);
}
.segmented {
    display: flex;
    padding: 3px;
    border-radius: 10px;
    background: rgb(255 255 255 / 0.05);
}
.segmented button {
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 13px;
    white-space: nowrap;
    color: rgb(255 255 255 / 0.6);
}
.segmented button.on {
    color: white;
    background: rgb(255 255 255 / 0.12);
}
.rent {
    min-width: 150px;
    padding: 10px 18px;
    border-radius: 10px;
    font-weight: 700;
    white-space: nowrap;
    background: rgb(var(--color-primary));
    transition:
        filter 0.15s,
        background 0.15s;
}
.rent:hover:not(:disabled) {
    filter: brightness(1.15);
}
.rent.confirm {
    color: #1a1206;
    background: #f0c46c;
}
.rent:disabled {
    cursor: not-allowed;
    color: rgb(255 255 255 / 0.45);
    background: rgb(255 255 255 / 0.06);
}
@media (max-width: 767px) {
    .shop {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: none;
        grid-template-areas: 'you' 'store' 'mine';
    }
    .rent {
        flex-grow: 1;
    }
}
@media (prefers-reduced-motion: reduce) {
    .swatch,
    .card,
    .tab {
        transition: none;
    }
}
</style>
