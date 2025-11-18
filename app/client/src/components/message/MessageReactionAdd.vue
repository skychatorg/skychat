<script setup>
import { useClientStore } from '@/stores/client';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
    messageId: {
        type: Number,
        required: true,
    },
});

const client = useClientStore();

const pickerOpen = ref(false);
const searchQuery = ref('');
const pickerRef = ref(null);
const searchInputRef = ref(null);

const MAX_RESULTS = 50;

const stickerEntries = computed(() => {
    const stickers = client.state.stickers || {};
    return Object.entries(stickers).sort(([a], [b]) => a.localeCompare(b));
});

const stickerLookup = computed(() => {
    const lookup = new Map();
    for (const [code] of stickerEntries.value) {
        lookup.set(code.toLowerCase(), code);
    }
    return lookup;
});

const filteredStickers = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    const entries = stickerEntries.value;
    if (!query) {
        return entries.slice(0, MAX_RESULTS);
    }
    return entries.filter(([code]) => code.toLowerCase().includes(query)).slice(0, MAX_RESULTS);
});

const hasStickers = computed(() => stickerEntries.value.length > 0);

const closePicker = () => {
    pickerOpen.value = false;
};

const openPicker = async () => {
    if (!hasStickers.value) {
        return;
    }
    pickerOpen.value = true;
    await nextTick();
    if (searchInputRef.value) {
        searchInputRef.value.focus();
    }
};

const togglePicker = () => {
    if (pickerOpen.value) {
        closePicker();
    } else {
        void openPicker();
    }
};

const findStickerCode = (rawValue) => {
    const trimmed = (rawValue || '').trim().toLowerCase();
    if (!trimmed) {
        return null;
    }

    const candidates = new Set();
    candidates.add(trimmed);
    if (!trimmed.startsWith(':')) {
        candidates.add(`:${trimmed}`);
    } else if (trimmed.length > 1) {
        candidates.add(trimmed.slice(1));
    }
    if (!trimmed.endsWith(':')) {
        candidates.add(`${trimmed}:`);
    } else if (trimmed.length > 1) {
        candidates.add(trimmed.slice(0, -1));
    }
    let wrapped = trimmed;
    if (!wrapped.startsWith(':')) {
        wrapped = `:${wrapped}`;
    }
    if (!wrapped.endsWith(':')) {
        wrapped = `${wrapped}:`;
    }
    candidates.add(wrapped);

    for (const candidate of candidates) {
        const match = stickerLookup.value.get(candidate);
        if (match) {
            return match;
        }
    }
    return null;
};

const sendReaction = (code) => {
    if (!code) {
        return;
    }
    client.sendMessage(`/reaction ${props.messageId} ${code}`);
    closePicker();
};

const onSubmitSearch = () => {
    const code = findStickerCode(searchQuery.value);
    if (code) {
        sendReaction(code);
    }
};

const onDocumentClick = (event) => {
    if (!pickerOpen.value) {
        return;
    }
    if (!pickerRef.value) {
        return;
    }
    if (!pickerRef.value.contains(event.target)) {
        closePicker();
    }
};

onMounted(() => {
    document.addEventListener('click', onDocumentClick);
});

onBeforeUnmount(() => {
    document.removeEventListener('click', onDocumentClick);
});

watch(pickerOpen, (open) => {
    if (!open) {
        searchQuery.value = '';
    }
});
</script>

<template>
    <div class="flex ml-[66px] mb-1">
        <div ref="pickerRef" class="relative">
            <button
                class="flex items-center rounded-full px-3 py-1 border transition text-xs gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 hover:-translate-y-0.5 hover:shadow-sm hover:shadow-primary/20 active:translate-y-0"
                :class="{
                    'border-primary/80 bg-primary/10 text-primary': pickerOpen,
                    'border-transparent bg-skygray-dark/25 text-gray-500 hover:border-skygray-light/60': !pickerOpen,
                }"
                type="button"
                :disabled="!hasStickers"
                :aria-expanded="pickerOpen"
                @click="togglePicker"
            >
                <span class="font-semibold">+</span>
                <span>Add reaction</span>
            </button>

            <div
                v-if="pickerOpen"
                class="absolute right-0 z-10 mt-2 w-64 sm:w-72 rounded-xl border border-skygray-light/50 bg-slate-800/95 p-3 shadow-xl"
            >
                <label class="sr-only" for="reaction-search-input">Search stickers</label>
                <input
                    id="reaction-search-input"
                    ref="searchInputRef"
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search sticker by code"
                    class="w-full rounded-md border border-skygray-light/30 bg-slate-900/70 px-2 py-1 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    @keydown.enter.prevent="onSubmitSearch"
                    @keydown.esc.prevent="closePicker"
                />
                <p class="mt-1 text-[11px] text-slate-400">Showing up to {{ MAX_RESULTS }} results</p>

                <div v-if="filteredStickers.length" class="mt-2 max-h-60 overflow-y-auto pr-1">
                    <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        <li v-for="[code, url] in filteredStickers" :key="code">
                            <button
                                type="button"
                                class="flex h-full w-full flex-col items-center gap-1 rounded-md border border-transparent bg-slate-900/40 px-2 py-2 text-[11px] text-white transition hover:border-primary/50 hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                @click="sendReaction(code)"
                            >
                                <img :src="url" :alt="code" class="h-10 w-10 object-contain" loading="lazy" />
                                <span class="w-full truncate text-center">{{ code }}</span>
                            </button>
                        </li>
                    </ul>
                </div>
                <div v-else class="mt-3 rounded-md bg-slate-900/60 px-3 py-2 text-center text-xs text-slate-300">
                    <span v-if="hasStickers">No stickers match your search</span>
                    <span v-else>No stickers are available on this instance yet</span>
                </div>
            </div>
        </div>
    </div>
</template>
