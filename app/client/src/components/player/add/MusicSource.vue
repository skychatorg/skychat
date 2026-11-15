<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useClientStore, apiClient } from '@/stores/client';
import { formatMs } from '@/lib/formatTime';
import { usePlayerAdd } from '@/composables/usePlayerAdd';

const client = useClientStore();
const { isQueued, send } = usePlayerAdd();

// Search results show this many songs before "Show all"
const SONGS_PREVIEW = 6;

const searchTerm = ref('');
const openAlbumId = ref(null);
const album = ref(null);
const albums = ref([]);
const songs = ref([]);
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');
const token = ref('');
const showAllSongs = ref(false);

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
    showAllSongs.value = false;
    load(0);
};

const loadMore = () => {
    if (loading.value || !hasMore.value || openAlbumId.value) return;
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

const onError = (message) => {
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

const songQueued = (song) => isQueued('navidrome', song.id);
const addSongs = (list) => {
    const ids = list.filter((song) => !songQueued(song)).map((song) => song.id);
    if (ids.length) send(`/navidrome ${ids.join(' ')}`);
};

const visibleSongs = computed(() =>
    openAlbumId.value || showAllSongs.value || !term.value ? songs.value : songs.value.slice(0, SONGS_PREVIEW),
);
const albumDuration = computed(() => songs.value.reduce((sum, song) => sum + song.duration, 0) * 1000);
const albumAllQueued = computed(() => songs.value.length > 0 && songs.value.every(songQueued));

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
    <div class="flex flex-col min-h-0">
        <div v-if="!openAlbumId" class="relative mb-3">
            <fa icon="magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-50" />
            <input
                v-model="searchTerm"
                type="search"
                placeholder="Search songs, albums, artists…"
                aria-label="Search the music library"
                class="form-control w-full pl-9"
                @input="onSearchInput"
            />
        </div>

        <div v-if="error" class="text-sm text-red-400 mb-2">{{ error }}</div>

        <div ref="scrollEl" class="grow min-h-0 overflow-y-auto scrollbar pr-1">
            <!-- Album -->
            <template v-if="openAlbumId">
                <button class="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 mb-3" @click="closeAlbum">
                    <fa icon="arrow-left" /> {{ term ? 'Back to the results' : 'Back to the albums' }}
                </button>
                <div v-if="album" class="flex items-end gap-4 mb-4">
                    <div
                        class="w-28 sm:w-36 aspect-square shrink-0 rounded-lg overflow-hidden bg-white/5 shadow-lg flex items-center justify-center"
                    >
                        <img v-if="showCover(album.coverArt)" :src="coverUrl(album.coverArt)" alt="" class="w-full h-full object-cover" />
                        <fa v-else icon="music" class="text-3xl opacity-40" />
                    </div>
                    <div class="min-w-0 flex flex-col gap-1">
                        <div class="text-xs uppercase tracking-wide opacity-50">Album</div>
                        <div class="text-xl font-semibold leading-tight line-clamp-2">{{ album.name }}</div>
                        <div class="text-sm opacity-70 truncate">
                            {{ album.artist }}<template v-if="album.year"> · {{ album.year }}</template>
                        </div>
                        <div class="text-xs opacity-50">
                            {{ songs.length }} {{ songs.length === 1 ? 'song' : 'songs' }} · {{ formatMs(albumDuration) }}
                        </div>
                        <button class="btn mt-1 self-start text-sm" :disabled="!songs.length || albumAllQueued" @click="addSongs(songs)">
                            <fa :icon="albumAllQueued ? 'check' : 'plus'" class="mr-1" />
                            {{ albumAllQueued ? 'Album queued' : 'Add the album' }}
                        </button>
                    </div>
                </div>
            </template>

            <div v-if="loading && !albums.length && !songs.length" class="text-center text-sm opacity-60 py-10">Loading…</div>
            <div v-else-if="!albums.length && !songs.length && !error" class="text-center text-sm opacity-60 py-10">
                {{ term ? `Nothing matches “${term}”` : 'The library is empty' }}
            </div>

            <!-- Songs: a click on the row adds the song -->
            <section v-if="songs.length" class="mb-5">
                <div v-if="!openAlbumId" class="text-xs uppercase tracking-wide opacity-50 mb-2">Songs</div>
                <ul class="flex flex-col">
                    <li v-for="song in visibleSongs" :key="song.id">
                        <button
                            class="song w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left hover:bg-white/5 disabled:cursor-default"
                            :disabled="songQueued(song)"
                            :title="songQueued(song) ? 'Already playing or queued' : 'Add to the queue'"
                            @click="addSongs([song])"
                        >
                            <span v-if="openAlbumId" class="w-6 text-right text-xs opacity-50 tabular-nums shrink-0">{{ song.track }}</span>
                            <span v-else class="h-9 w-9 rounded overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                                <img
                                    v-if="showCover(song.coverArt)"
                                    :src="coverUrl(song.coverArt, 80)"
                                    alt=""
                                    loading="lazy"
                                    class="h-full w-full object-cover"
                                    @error="failedCovers.add(song.coverArt)"
                                />
                                <fa v-else icon="music" class="text-xs opacity-40" />
                            </span>
                            <span class="min-w-0 flex-1">
                                <span class="block text-sm truncate">{{ song.title }}</span>
                                <span class="block text-xs opacity-60 truncate">
                                    {{ song.artist }}<template v-if="!openAlbumId && song.album"> · {{ song.album }}</template>
                                </span>
                            </span>
                            <span class="text-xs opacity-50 tabular-nums shrink-0">{{ formatMs(song.duration * 1000) }}</span>
                            <span
                                class="add-icon w-7 h-7 shrink-0 rounded-full flex items-center justify-center"
                                :class="songQueued(song) ? 'text-primary' : 'bg-white/5'"
                            >
                                <fa :icon="songQueued(song) ? 'check' : 'plus'" class="text-xs" />
                            </span>
                        </button>
                    </li>
                </ul>
                <button
                    v-if="!openAlbumId && term && !showAllSongs && songs.length > SONGS_PREVIEW"
                    class="mt-1 px-2 text-sm text-primary hover:underline"
                    @click="showAllSongs = true"
                >
                    Show all {{ songs.length }} songs
                </button>
            </section>

            <!-- Albums -->
            <section v-if="albums.length">
                <div class="text-xs uppercase tracking-wide opacity-50 mb-2">{{ term ? 'Albums' : 'Recently added' }}</div>
                <div class="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
                    <button v-for="item in albums" :key="item.id" class="group flex flex-col text-left min-w-0" @click="openAlbum(item)">
                        <span
                            class="aspect-square w-full overflow-hidden rounded-lg bg-white/5 ring-2 ring-inset ring-transparent group-hover:ring-[rgb(var(--color-primary))] flex items-center justify-center"
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
                        </span>
                        <span class="mt-1 text-sm leading-tight line-clamp-2" :title="item.name">{{ item.name }}</span>
                        <span class="text-xs opacity-60 truncate">{{ item.artist }}</span>
                    </button>
                </div>
            </section>

            <div ref="sentinel" class="h-px"></div>
        </div>
    </div>
</template>

<style scoped>
.song:not(:disabled) .add-icon {
    transition: background-color 0.15s ease;
}
.song:not(:disabled):hover .add-icon {
    background: rgb(var(--color-primary) / 0.25);
}
</style>
