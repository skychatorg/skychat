<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore, apiClient } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';

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

const queue = (item) => {
    if (item.isFolder) return;
    client.sendMessage(`/jellyfin ${item.id}`);
    app.closeModal('jellyfin');
};

const posterUrl = (item) => {
    const token = browseToken.value || client.state.player.streamToken;
    if (!item.primaryTag || !token) return null;
    return `/api/plugin/player/jellyfin/image/${item.id}/Primary?tag=${encodeURIComponent(item.primaryTag)}&t=${encodeURIComponent(token)}`;
};

const showPoster = (item) => posterUrl(item) && !failedPosters.value.has(item.id);

const isPlayable = (item) => !item.isFolder;

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

        <div ref="scrollEl" class="grow overflow-y-auto scrollbar flex flex-col gap-1">
            <template v-if="loading && items.length === 0">
                <div class="text-center text-sm opacity-60 py-6">Loading…</div>
            </template>
            <template v-else-if="items.length === 0">
                <div class="text-center text-sm opacity-60 py-6">No items</div>
            </template>
            <HoverCard v-for="item in items" :key="item.id" :selectable="true" :border-color="'rgb(var(--color-skygray-light))'">
                <div
                    class="group cursor-pointer select-none px-3 py-2 flex flex-nowrap items-center gap-3"
                    @click="item.isFolder ? enter(item) : queue(item)"
                >
                    <div class="basis-10 shrink-0 flex items-center justify-center">
                        <img
                            v-if="showPoster(item)"
                            :src="posterUrl(item)"
                            loading="lazy"
                            decoding="async"
                            class="h-10 w-7 object-cover rounded"
                            @error="failedPosters.add(item.id)"
                        />
                        <fa v-else-if="item.isFolder" icon="folder" />
                        <fa v-else icon="film" />
                    </div>
                    <div class="w-0 grow">
                        <div class="truncate" :title="item.name">
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
                    <div class="shrink-0 text-xs opacity-60 uppercase">
                        <template v-if="item.isFolder">{{ item.type }}</template>
                        <template v-else-if="isPlayable(item)">Play</template>
                    </div>
                </div>
            </HoverCard>
            <!-- Infinite-scroll trigger: loadMore fires when this enters the scroll viewport. -->
            <div ref="sentinel" class="h-px"></div>
        </div>
    </div>
</template>

<style scoped></style>
