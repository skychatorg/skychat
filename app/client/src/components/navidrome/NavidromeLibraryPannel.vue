<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore, apiClient } from '@/stores/client';
import { formatMs } from '@/lib/formatTime';

const app = useAppStore();
const client = useClientStore();

const searchTerm = ref('');
// The album opened from the grid, or null to show the grid
const openAlbumId = ref(null);
const album = ref(null);
const albums = ref([]);
const songs = ref([]);
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');
const token = ref('');

const scrollEl = ref(null);
const sentinel = ref(null);
let observer = null;
let searchTimer = null;

const term = computed(() => searchTerm.value.trim());
// Which view a response belongs to, so a late answer for a view we left is dropped
const currentKey = () => (openAlbumId.value ? `album:${openAlbumId.value}` : term.value ? `search:${term.value}` : 'newest');

const load = (startIndex) => {
    loading.value = true;
    error.value = '';
    if (openAlbumId.value) {
        client.sendMessage(`/navidromels album ${openAlbumId.value}`);
    } else if (term.value) {
        client.sendMessage(`/navidromesearch ${startIndex} ${term.value}`);
    } else {
        client.sendMessage(`/navidromels newest ${startIndex}`);
    }
};

const refresh = () => {
    albums.value = [];
    songs.value = [];
    album.value = null;
    hasMore.value = false;
    load(0);
};

const loadMore = () => {
    if (loading.value || !hasMore.value) return;
    load(Math.max(albums.value.length, songs.value.length));
};

const onLibrary = (payload) => {
    if (payload.key !== currentKey()) return;
    loading.value = false;
    const append = payload.startIndex > 0;
    albums.value = append ? albums.value.concat(payload.albums) : payload.albums;
    songs.value = append ? songs.value.concat(payload.songs) : payload.songs;
    album.value = payload.album ?? null;
    hasMore.value = payload.hasMore;
    token.value = payload.streamToken;
};

// Songs queued from this panel, ticked right away
const queued = ref(new Set());

const onError = (message) => {
    // A refused queue is toasted globally: drop the optimistic ticks so the songs can be retried
    queued.value = new Set();
    if (typeof message === 'string' && /music library/i.test(message)) {
        loading.value = false;
        error.value = message;
    }
};

const onSearchInput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refresh, 300);
};

const openAlbum = (item) => {
    openAlbumId.value = item.id;
    refresh();
    scrollEl.value?.scrollTo({ top: 0 });
};

const closeAlbum = () => {
    openAlbumId.value = null;
    refresh();
};

const coverUrl = (coverArt, size = 300) =>
    coverArt && token.value
        ? `/api/plugin/player/navidrome/cover/${encodeURIComponent(coverArt)}?size=${size}&t=${encodeURIComponent(token.value)}`
        : null;

const failedCovers = ref(new Set());
const showCover = (coverArt) => coverUrl(coverArt) && !failedCovers.value.has(coverArt);

// One command queues every id in order: a single rate-limit hit, server-side order preserved
const queue = (items) => {
    if (items.length === 0) return;
    client.sendMessage(`/navidrome ${items.map((s) => s.id).join(' ')}`);
};
const queueSong = (song) => {
    queue([song]);
    queued.value.add(song.id);
};
const queueAlbum = () => {
    queue(songs.value);
    app.closeModal('navidrome');
};

onMounted(() => {
    apiClient.on('navidrome-library', onLibrary);
    apiClient.on('error', onError);
    refresh();
    observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), {
        root: scrollEl.value,
        rootMargin: '200px',
    });
    nextTick(() => sentinel.value && observer.observe(sentinel.value));
});

onBeforeUnmount(() => {
    apiClient.removeListener('navidrome-library', onLibrary);
    apiClient.removeListener('error', onError);
    observer?.disconnect();
    clearTimeout(searchTimer);
});
</script>

<template>
    <div class="flex flex-col h-full">
        <input
            v-if="!openAlbumId"
            v-model="searchTerm"
            type="text"
            placeholder="Search albums and songs…"
            class="form-control w-full mb-2"
            @input="onSearchInput"
        />

        <!-- Album header -->
        <div v-else class="flex items-center gap-3 mb-3">
            <button class="form-control px-3 py-1" title="Back" @click="closeAlbum"><fa icon="arrow-left" /></button>
            <img
                v-if="album && showCover(album.coverArt)"
                :src="coverUrl(album.coverArt, 80)"
                alt=""
                class="h-12 w-12 rounded object-cover"
            />
            <div v-if="album" class="min-w-0">
                <div class="font-semibold truncate">{{ album.name }}</div>
                <div class="text-xs opacity-60 truncate">
                    {{ album.artist }}<template v-if="album.year"> · {{ album.year }}</template>
                </div>
            </div>
            <button v-if="songs.length" class="ml-auto form-control px-3 py-1 text-sm text-primary shrink-0" @click="queueAlbum">
                <fa icon="plus" class="mr-1" /> Queue album
            </button>
        </div>

        <div v-if="error" class="text-sm text-red-400 mb-2">{{ error }}</div>

        <div ref="scrollEl" class="grow overflow-y-auto scrollbar">
            <div v-if="loading && !albums.length && !songs.length" class="text-center text-sm opacity-60 py-6">Loading…</div>
            <div v-else-if="!albums.length && !songs.length" class="text-center text-sm opacity-60 py-6">
                {{ term ? 'Nothing matches this search' : 'No albums' }}
            </div>

            <!-- Albums -->
            <template v-if="albums.length">
                <div v-if="term" class="text-xs uppercase tracking-wide opacity-50 mb-2">Albums</div>
                <div class="grid gap-3 mb-4 [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))]">
                    <button v-for="item in albums" :key="item.id" class="group flex flex-col text-left min-w-0" @click="openAlbum(item)">
                        <div
                            class="aspect-square w-full overflow-hidden rounded bg-skygray-dark/40 ring-2 ring-inset ring-transparent group-hover:ring-[rgb(var(--color-primary))] flex items-center justify-center"
                        >
                            <img
                                v-if="showCover(item.coverArt)"
                                :src="coverUrl(item.coverArt)"
                                alt=""
                                loading="lazy"
                                decoding="async"
                                class="h-full w-full object-cover"
                                @error="failedCovers.add(item.coverArt)"
                            />
                            <fa v-else icon="music" class="text-2xl opacity-40" />
                        </div>
                        <div class="mt-1 text-sm leading-tight line-clamp-2" :title="item.name">{{ item.name }}</div>
                        <div class="text-xs opacity-60 truncate">{{ item.artist }}</div>
                    </button>
                </div>
            </template>

            <!-- Songs -->
            <template v-if="songs.length">
                <div v-if="term" class="text-xs uppercase tracking-wide opacity-50 mb-2">Songs</div>
                <ul class="flex flex-col">
                    <li v-for="song in songs" :key="song.id" class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white/5">
                        <span v-if="openAlbumId" class="w-6 text-right text-xs opacity-50 tabular-nums">{{ song.track }}</span>
                        <img
                            v-else-if="showCover(song.coverArt)"
                            :src="coverUrl(song.coverArt, 80)"
                            alt=""
                            loading="lazy"
                            class="h-8 w-8 rounded object-cover"
                        />
                        <div class="min-w-0 flex-1">
                            <div class="text-sm truncate">{{ song.title }}</div>
                            <div class="text-xs opacity-60 truncate">
                                {{ song.artist }}<template v-if="!openAlbumId && song.album"> · {{ song.album }}</template>
                            </div>
                        </div>
                        <span class="text-xs opacity-50 tabular-nums">{{ formatMs(song.duration * 1000) }}</span>
                        <button
                            class="form-control px-2 py-1 text-xs"
                            :title="queued.has(song.id) ? 'Queued' : 'Add to the queue'"
                            :disabled="queued.has(song.id)"
                            @click="queueSong(song)"
                        >
                            <fa :icon="queued.has(song.id) ? 'check' : 'plus'" />
                        </button>
                    </li>
                </ul>
            </template>

            <div ref="sentinel" class="h-px"></div>
        </div>
    </div>
</template>
