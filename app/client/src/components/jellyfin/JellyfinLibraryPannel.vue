<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore, apiClient } from '@/stores/client';
import draggable from 'vuedraggable';

const app = useAppStore();
const client = useClientStore();

// Breadcrumb is a stack of { id, name } (id=null for root).
const breadcrumb = ref([{ id: null, name: 'Library' }]);
const items = ref([]);
const total = ref(0);
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');
const browseToken = ref('');
const searchTerm = ref('');
const failedPosters = ref(new Set());

const scrollEl = ref(null);
const sentinel = ref(null);
let observer = null;
let searchTimer = null;

// A non-empty search box switches the panel from folder-browsing to whole-library search.
const mode = computed(() => (searchTerm.value.trim() ? 'search' : 'browse'));
const currentParentId = () => breadcrumb.value[breadcrumb.value.length - 1].id;

// Identify the view a payload belongs to. Search responses carry no parentId, which would
// otherwise collide with the root view (also parentId=null) — so key off mode explicitly.
const currentKey = () => (mode.value === 'search' ? `s:${searchTerm.value.trim()}` : `b:${currentParentId() ?? 'root'}`);
const keyOf = (p) => (p.mode === 'search' ? `s:${p.search}` : `b:${p.parentId ?? 'root'}`);

const load = (startIndex) => {
    loading.value = true;
    error.value = '';
    if (mode.value === 'search') {
        // startIndex first, term last: term may contain spaces, the server reads it as the remainder.
        client.sendMessage(`/jellyfinsearch ${startIndex} ${searchTerm.value.trim()}`);
    } else {
        const parentId = currentParentId();
        const suffix = startIndex > 0 ? ` ${startIndex}` : '';
        client.sendMessage(parentId ? `/jellyfinls ${parentId}${suffix}` : '/jellyfinls');
    }
};

const refresh = () => {
    items.value = [];
    hasMore.value = false;
    load(0);
};

const loadMore = () => {
    if (loading.value || !hasMore.value) return;
    // Root browse lists libraries (paging is ignored there); only folders and search paginate.
    if (mode.value === 'browse' && currentParentId() == null) return;
    load(items.value.length);
};

const onLibrary = (payload) => {
    // Drop responses for a view we're no longer looking at: navigating/typing quickly can let an
    // earlier listing arrive after we've moved on, clobbering the current view.
    if (keyOf(payload) !== currentKey()) {
        return;
    }
    loading.value = false;
    const incoming = payload.items || [];
    items.value = payload.startIndex > 0 ? items.value.concat(incoming) : incoming;
    total.value = payload.total || 0;
    hasMore.value = items.value.length < total.value;
    if (payload.streamToken) {
        browseToken.value = payload.streamToken;
    }
};

const onError = (message) => {
    if (typeof message === 'string' && /jellyfin/i.test(message)) {
        loading.value = false;
        error.value = message;
    }
};

const onSearchInput = () => {
    // Debounce so a burst of keystrokes coalesces into one request (and respects the command cooldown).
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refresh, 300);
};

const enter = (item) => {
    if (!item.isFolder) return;
    // Leaving search results into folder-browse: clear the search so the breadcrumb takes over.
    searchTerm.value = '';
    breadcrumb.value.push({ id: item.id, name: item.name });
    refresh();
};

const leave = () => {
    if (breadcrumb.value.length <= 1) return;
    breadcrumb.value.pop();
    refresh();
};

// Pick a batch first, order it, then queue it all at once. Selection survives folder
// navigation, so you can gather items from different folders before submitting.
const selected = ref([]);
const isSelected = (item) => selected.value.some((s) => s.id === item.id);
const selectionIndex = (item) => selected.value.findIndex((s) => s.id === item.id) + 1;
const toggleSelect = (item) => {
    if (item.isFolder) return;
    if (isSelected(item)) {
        selected.value = selected.value.filter((s) => s.id !== item.id);
    } else {
        selected.value.push(item);
    }
};
const clearSelection = () => {
    selected.value = [];
};
const submitSelection = () => {
    if (selected.value.length === 0) return;
    // One command queues every id in order: a single rate-limit hit, server-side order preserved.
    client.sendMessage(`/jellyfin ${selected.value.map((s) => s.id).join(' ')}`);
    clearSelection();
    app.closeModal('jellyfin');
};

const posterUrl = (item) => {
    const token = browseToken.value || client.state.player.streamToken;
    if (!item.primaryTag || !token) return null;
    return `/api/plugin/player/jellyfin/image/${item.id}/Primary?tag=${encodeURIComponent(item.primaryTag)}&t=${encodeURIComponent(token)}`;
};

const showPoster = (item) => posterUrl(item) && !failedPosters.value.has(item.id);

const isPlayable = (item) => !item.isFolder;

// The root view lists libraries: a few large 16:9 covers rather than a dense poster grid.
const atLibraryRoot = computed(() => mode.value === 'browse' && currentParentId() == null);

// Episodes and Jellyfin's auto-generated library covers are 16:9; movie/series/season posters are 2:3.
const posterAspect = (item) => (item.type === 'Episode' || atLibraryRoot.value ? 'aspect-video' : 'aspect-[2/3]');

onMounted(() => {
    apiClient.on('jellyfin-library', onLibrary);
    apiClient.on('error', onError);
    refresh();
    observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), {
        root: scrollEl.value,
        rootMargin: '200px',
    });
    nextTick(() => sentinel.value && observer.observe(sentinel.value));
});

onBeforeUnmount(() => {
    apiClient.removeListener('jellyfin-library', onLibrary);
    apiClient.removeListener('error', onError);
    if (observer) observer.disconnect();
    clearTimeout(searchTimer);
});
</script>

<template>
    <div class="flex flex-col h-full">
        <!-- Search the whole library (recursive) -->
        <input v-model="searchTerm" type="text" placeholder="Search the library…" class="form-control w-full mb-2" @input="onSearchInput" />

        <!-- Breadcrumb (folder-browse only) -->
        <div class="flex items-center gap-2 mb-2 text-sm">
            <button
                class="form-control px-3 py-1 disabled:opacity-40"
                :disabled="breadcrumb.length <= 1 || mode === 'search'"
                title="Go up one level"
                @click="leave"
            >
                <fa icon="arrow-left" />
            </button>
            <div class="truncate opacity-70">
                <template v-if="mode === 'search'">Search results</template>
                <template v-else>{{ breadcrumb.map((b) => b.name).join(' / ') }}</template>
            </div>
            <div v-if="total" class="ml-auto text-xs opacity-50">{{ total }} items</div>
        </div>

        <div v-if="error" class="text-sm text-red-400 mb-2">{{ error }}</div>

        <div ref="scrollEl" class="grow overflow-y-auto scrollbar">
            <div v-if="loading && items.length === 0" class="text-center text-sm opacity-60 py-6">Loading…</div>
            <div v-else-if="items.length === 0" class="text-center text-sm opacity-60 py-6">No items</div>

            <div
                v-else
                class="grid gap-3"
                :class="
                    atLibraryRoot
                        ? '[grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]'
                        : '[grid-template-columns:repeat(auto-fill,minmax(130px,1fr))]'
                "
            >
                <div
                    v-for="item in items"
                    :key="item.id"
                    class="group cursor-pointer select-none min-w-0"
                    @click="item.isFolder ? enter(item) : toggleSelect(item)"
                >
                    <!-- Poster / thumb -->
                    <div
                        class="relative w-full overflow-hidden rounded bg-skygray-dark/40 ring-2 ring-inset transition-colors"
                        :class="[posterAspect(item), isSelected(item) ? 'ring-[rgb(var(--color-primary))]' : 'ring-transparent group-hover:ring-[rgb(var(--color-primary))]']"
                    >
                        <img
                            v-if="showPoster(item)"
                            :src="posterUrl(item)"
                            loading="lazy"
                            decoding="async"
                            class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                            @error="failedPosters.add(item.id)"
                        />
                        <div v-else class="h-full w-full flex items-center justify-center text-2xl opacity-40">
                            <fa :icon="item.isFolder ? 'folder' : 'film'" />
                        </div>

                        <!-- Order badge when selected -->
                        <div
                            v-if="isSelected(item)"
                            class="absolute top-1 left-1 h-6 min-w-6 px-1 rounded-full bg-[rgb(var(--color-primary))] text-white text-xs font-bold flex items-center justify-center shadow"
                        >
                            {{ selectionIndex(item) }}
                        </div>

                        <!-- Add affordance on hover (unselected playables only) -->
                        <div
                            v-if="isPlayable(item) && !isSelected(item)"
                            class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100"
                        >
                            <fa icon="plus" class="text-2xl" />
                        </div>
                    </div>

                    <!-- Title + meta -->
                    <div class="mt-1 min-w-0">
                        <div class="text-sm leading-tight line-clamp-2" :title="item.name">
                            {{ item.name }}
                            <span v-if="item.productionYear" class="opacity-50 text-xs">({{ item.productionYear }})</span>
                        </div>
                        <div v-if="item.type === 'Episode' && item.seriesName" class="truncate text-xs opacity-60">
                            {{ item.seriesName }}
                            <template v-if="item.parentIndexNumber != null">
                                · S{{ String(item.parentIndexNumber).padStart(2, '0') }}E{{ String(item.indexNumber).padStart(2, '0') }}
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Infinite-scroll trigger: sibling of the grid so it lands on its own full-width row below the last tile. -->
            <div ref="sentinel" class="h-px"></div>
        </div>

        <!-- Selection tray: drag the chips to set play order, then queue them all at once. -->
        <div v-if="selected.length" class="shrink-0 border-t border-skygray-light/40 pt-2 mt-2">
            <div class="flex items-center gap-2 mb-2 text-sm">
                <span class="opacity-70">{{ selected.length }} selected · drag to reorder</span>
                <button class="ml-auto form-control px-3 py-1 text-xs" @click="clearSelection">Clear</button>
                <button class="form-control px-3 py-1 text-xs text-primary" @click="submitSelection">Add {{ selected.length }} to queue</button>
            </div>
            <draggable v-model="selected" item-key="id" :animation="150" class="flex gap-2 overflow-x-auto pb-1 scrollbar">
                <template #item="{ element, index }">
                    <div class="shrink-0 flex items-center gap-2 bg-skygray-dark/60 rounded-lg pl-1 pr-2 py-1 cursor-grab active:cursor-grabbing">
                        <img v-if="showPoster(element)" :src="posterUrl(element)" class="h-8 w-8 object-cover rounded" />
                        <span class="text-xs opacity-50 w-4 text-center">{{ index + 1 }}</span>
                        <span class="truncate max-w-[160px] text-sm" :title="element.name">{{ element.name }}</span>
                        <button class="text-skygray-lighter hover:text-danger" title="Remove" @click.stop="toggleSelect(element)">
                            <fa icon="xmark" />
                        </button>
                    </div>
                </template>
            </draggable>
        </div>
    </div>
</template>

<style scoped></style>
