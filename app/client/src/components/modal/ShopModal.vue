<script setup>
import { computed, reactive, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useNow } from '@/composables/useNow';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import { formatMoney } from '../../../../api/money.ts';
import { COLORS, SHOP } from '../../../../api/shop.ts';
import { nameStyle } from '@/lib/cosmetics';

const app = useAppStore();
const client = useClientStore();
const now = useNow(30_000);

const user = computed(() => client.state.user);
const worn = computed(() => user.value.data.plugins.custom ?? {});
const loggedIn = computed(() => user.value.right >= 0);

const until = (slot) => worn.value[`${slot}Until`] ?? 0;
const renting = (slot) => until(slot) > now.value;

/** The option each item shows as picked: what is worn while it is rented, else what was clicked to try it */
const picked = reactive({});
const optionOf = (slot) => {
    const value = worn.value[slot];
    return slot === 'color' ? String(COLORS.find((color) => color.value === value)?.id) : value;
};
const selected = (slot) => (renting(slot) ? optionOf(slot) : picked[slot]);
watch(
    () => app.modals.shop,
    (open) => open && Object.keys(picked).forEach((slot) => delete picked[slot]),
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
    return { username: user.value.username, data: { plugins: { ...user.value.data.plugins, custom } } };
});

const timeLeft = (slot) => {
    const minutes = Math.max(0, Math.floor((until(slot) - now.value) / 60_000));
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor(minutes / 60) % 24;
    if (days > 0) return `${days}d ${hours}h left`;
    return hours > 0 ? `${hours}h ${minutes % 60}m left` : `${minutes}m left`;
};

/** Why a rental can't be bought, shown on its button */
const blocker = (slot, price) => {
    if (!renting(slot) && SHOP[slot].options && !picked[slot]) return 'Pick one first';
    if (user.value.money < price) return `${formatMoney(price - user.value.money)} short`;
    return null;
};
const buy = (slot, duration) => {
    const option = selected(slot);
    client.sendMessage(`/custom buy ${option ? `${slot}:${option}` : slot} ${duration}`);
};

const colorHex = (id) => COLORS.find((color) => String(color.id) === id)?.value;
</script>

<template>
    <ModalTemplate id="shop" title="Shop" variant="dialog">
        <div class="shop">
            <!-- You, as others will see you -->
            <div class="preview">
                <div class="avatar" :style="{ borderColor: preview.data.plugins.custom.color }">
                    <img :src="user.data.plugins.avatar" :alt="user.username" />
                </div>
                <div class="min-w-0">
                    <div class="who">
                        <span v-bind="nameStyle(preview)">{{ user.username }}</span>
                    </div>
                    <div class="hint">How others see you</div>
                </div>
                <div class="balance">{{ formatMoney(user.money) }}</div>
            </div>

            <p v-if="!loggedIn" class="hint text-center">Log in to shop.</p>

            <section v-for="(item, slot) in SHOP" :key="slot" class="item">
                <header class="item-head">
                    <h3 class="item-name">{{ item.name }}</h3>
                    <span v-if="renting(slot)" class="tag">{{ timeLeft(slot) }}</span>
                </header>
                <p class="hint">
                    {{ item.pitch }}<template v-if="renting(slot) && item.options"> Switch for free while it lasts.</template>
                </p>

                <div v-if="slot === 'color'" class="swatches">
                    <button
                        v-for="option in item.options"
                        :key="option.id"
                        class="swatch"
                        :class="{ on: selected(slot) === option.id }"
                        :style="{ backgroundColor: colorHex(option.id) }"
                        :title="option.name"
                        :aria-label="option.name"
                        :aria-pressed="selected(slot) === option.id"
                        @click="choose(slot, option.id)"
                    />
                </div>

                <div v-else-if="slot === 'effect'" class="chips">
                    <button
                        v-for="option in item.options"
                        :key="option.id"
                        class="chip"
                        :class="{ on: selected(slot) === option.id }"
                        :aria-pressed="selected(slot) === option.id"
                        @click="choose(slot, option.id)"
                    >
                        <span
                            v-bind="nameStyle({ data: { plugins: { custom: { ...preview.data.plugins.custom, effect: option.id } } } })"
                            >{{ option.name }}</span
                        >
                    </button>
                </div>

                <div class="buys">
                    <button
                        v-for="(price, duration) in item.prices"
                        :key="duration"
                        class="buy"
                        :disabled="!loggedIn || !!blocker(slot, price)"
                        @click="buy(slot, duration)"
                    >
                        <span class="duration">{{ renting(slot) ? '+' : '' }}1 {{ duration }}</span>
                        <span class="price">{{ loggedIn && blocker(slot, price) ? blocker(slot, price) : formatMoney(price) }}</span>
                    </button>
                </div>
            </section>
        </div>
    </ModalTemplate>
</template>

<style scoped>
.shop {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 16px;
}
.preview {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 14px;
    background: rgb(255 255 255 / 0.04);
    border: 1px solid rgb(255 255 255 / 0.08);
}
.avatar {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 8px;
    border: 3px solid;
    background: black;
    transition: border-color 0.2s;
}
.avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.who {
    font-size: 18px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.2s;
}
.balance {
    margin-left: auto;
    font-family: ui-monospace, monospace;
    font-size: 15px;
    color: #f0c46c;
}
.hint {
    margin: 0;
    font-size: 13px;
    color: rgb(255 255 255 / 0.55);
}
.item {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 14px;
    background: rgb(255 255 255 / 0.06);
    border: 2px solid rgb(255 255 255 / 0.12);
}
.item-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
}
.item-name {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
}
.tag {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: rgb(52 211 153);
}
.swatches {
    display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 6px;
}
.swatch {
    aspect-ratio: 1;
    border-radius: 6px;
    outline: 2px solid transparent;
    outline-offset: 2px;
    transition:
        transform 0.1s,
        outline-color 0.1s;
}
.swatch:hover {
    transform: scale(1.12);
}
.swatch.on {
    outline-color: white;
}
.chips {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 6px;
}
.chip {
    padding: 8px;
    border-radius: 10px;
    font-weight: 700;
    background: rgb(255 255 255 / 0.04);
    border: 2px solid rgb(255 255 255 / 0.1);
    transition: border-color 0.15s;
}
.chip:hover {
    border-color: rgb(255 255 255 / 0.3);
}
.chip.on {
    border-color: white;
}
.buys {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
}
.buy {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgb(var(--color-primary) / 0.15);
    border: 1px solid rgb(var(--color-primary) / 0.4);
    transition: background 0.15s;
}
.buy:hover:not(:disabled) {
    background: rgb(var(--color-primary) / 0.28);
}
.buy:disabled {
    cursor: not-allowed;
    background: rgb(255 255 255 / 0.04);
    border-color: rgb(255 255 255 / 0.1);
    color: rgb(255 255 255 / 0.45);
}
.duration {
    font-weight: 600;
}
.price {
    font-family: ui-monospace, monospace;
    font-size: 12px;
}
@media (max-width: 480px) {
    .swatches {
        grid-template-columns: repeat(8, minmax(0, 1fr));
    }
}
@media (prefers-reduced-motion: reduce) {
    .swatch,
    .avatar,
    .who {
        transition: none;
    }
}
</style>
